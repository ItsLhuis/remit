import { and, eq, isNull } from "drizzle-orm"

import { writeAudit } from "@/lib/audit"

import { logger } from "@/lib/logger"

import { enqueueJob } from "@/lib/jobs"
import { renderHtmlToPdf, storeDocumentPdf } from "@/lib/pdf"

import { database } from "@/database"
import { contracts, contractSignatures } from "@/database/schema"

import { buildContractPdfDocument, buildSignedContractPdfDocument } from "./pdfDocument"

// The consumer half of ADR-0022 for contracts, and the only feature with two PDF jobs: the contract
// as sent, and the executed copy carrying the signature record. They are separate job names because
// they are produced at different moments by different actors — one when the owner sends, one when a
// counterparty signs — and because only the second may touch `contract_signatures`.

// Rendered once and never regenerated, like every other document PDF: the stored object is the
// snapshot of what was sent (`pdf_upload_id` in `database/schema/contracts.ts`).
export async function renderContractPdf(payload: {
  contractId: string
  email?: boolean
}): Promise<void> {
  const [existing] = await database
    .select({ pdfUploadId: contracts.pdfUploadId, number: contracts.number })
    .from(contracts)
    .where(eq(contracts.id, payload.contractId))
    .limit(1)

  if (!existing) return

  // A document that already has its PDF still owes its email. The render is what is idempotent here,
  // not the send — `sendDocumentEmail` has its own durable guard — so returning early without
  // chaining would drop the mail whenever a render was retried after succeeding.
  if (existing.pdfUploadId) {
    await enqueueDocumentEmail(payload)

    return
  }

  const document = await buildContractPdfDocument(payload.contractId)

  if (!document) {
    logger.error(
      { action: "renderContractPdf", contractId: payload.contractId },
      "Contract PDF skipped: no document to render"
    )

    await writeContractPdfFailureAudit(payload.contractId, "noDocument")

    return
  }

  let uploadId: string

  try {
    const bytes = await renderHtmlToPdf({
      html: document.html,
      widthPx: document.widthPx,
      heightPx: document.heightPx
    })

    uploadId = await storeDocumentPdf({
      bytes,
      kind: "contract",
      documentId: payload.contractId,
      filename: `${existing.number}.pdf`
    })
  } catch (error) {
    // Never the rendered HTML or the bytes: a contract is the parties' agreement in full
    // (`security.md`). The error and the id are enough to find it.
    logger.error(
      { action: "renderContractPdf", contractId: payload.contractId, err: error },
      "Contract PDF render failed"
    )

    await writeContractPdfFailureAudit(payload.contractId, "renderFailed")

    throw error
  }

  await database
    .update(contracts)
    .set({ pdfUploadId: uploadId })
    .where(and(eq(contracts.id, payload.contractId), isNull(contracts.pdfUploadId)))

  await writeAudit("contract.pdf_rendered", {
    actorUserId: null,
    targetEntityType: "contract",
    targetEntityId: payload.contractId,
    metadata: { uploadId },
    ipAddress: null,
    userAgent: null
  })

  await enqueueDocumentEmail(payload)
}

// The executed copy. Its idempotency guard is `contract_signatures.signed_pdf_upload_id`, not the
// contract's own pointer: the two are different documents, and a contract that already has an
// as-sent PDF must still get a signed one.
//
// That column is write-once and enforced by a database trigger (`0001_insert_only_guards.sql`):
// the row is
// otherwise insert-only, because a signature is the legal record of what a counterparty agreed to.
// The conditional `IS NULL` below is what keeps a re-delivery from reaching the trigger at all — a
// second write would raise rather than be ignored, and the guard exists so a retry is a no-op
// instead of a failed job.
export async function renderSignedContractPdf(payload: {
  contractId: string
  signatureId: string
}): Promise<void> {
  const [signature] = await database
    .select({ signedPdfUploadId: contractSignatures.signedPdfUploadId })
    .from(contractSignatures)
    .where(
      and(
        eq(contractSignatures.id, payload.signatureId),
        eq(contractSignatures.contractId, payload.contractId)
      )
    )
    .limit(1)

  if (!signature || signature.signedPdfUploadId) return

  // Independent of each other: the number only names the file, and the document build re-reads the
  // contract itself.
  const [[contract], document] = await Promise.all([
    database
      .select({ number: contracts.number })
      .from(contracts)
      .where(eq(contracts.id, payload.contractId))
      .limit(1),
    buildSignedContractPdfDocument(payload.contractId, payload.signatureId)
  ])

  if (!document || !contract) {
    logger.error(
      { action: "renderSignedContractPdf", contractId: payload.contractId },
      "Signed contract PDF skipped: no document to render"
    )

    await writeContractPdfFailureAudit(payload.contractId, "noDocument")

    return
  }

  let uploadId: string

  try {
    const bytes = await renderHtmlToPdf({
      html: document.html,
      widthPx: document.widthPx,
      heightPx: document.heightPx
    })

    uploadId = await storeDocumentPdf({
      bytes,
      kind: "contract_signed",
      documentId: payload.contractId,
      filename: `${contract.number}-signed.pdf`
    })
  } catch (error) {
    logger.error(
      { action: "renderSignedContractPdf", contractId: payload.contractId, err: error },
      "Signed contract PDF render failed"
    )

    await writeContractPdfFailureAudit(payload.contractId, "renderFailed")

    throw error
  }

  await database
    .update(contractSignatures)
    .set({ signedPdfUploadId: uploadId })
    .where(
      and(
        eq(contractSignatures.id, payload.signatureId),
        isNull(contractSignatures.signedPdfUploadId)
      )
    )

  await writeAudit("contract.signed_pdf_rendered", {
    actorUserId: null,
    targetEntityType: "contract",
    targetEntityId: payload.contractId,
    metadata: { uploadId, signatureId: payload.signatureId },
    ipAddress: null,
    userAgent: null
  })
}

// Failure is recorded in the audit log rather than in a status column. `audit_log` is insert-only so
// a later success cannot erase the record of a failure, and a document with no pointer is already
// unambiguous on screen.
async function writeContractPdfFailureAudit(contractId: string, reason: string): Promise<void> {
  await writeAudit("contract.pdf_render_failed", {
    actorUserId: null,
    targetEntityType: "contract",
    targetEntityId: contractId,
    metadata: { reason },
    ipAddress: null,
    userAgent: null
  })
}

// The chain from ADR-0022's artifact to the mail that carries it. Enqueued only after the pointer is
// linked, so the send job always finds a PDF to attach.
async function enqueueDocumentEmail(payload: {
  contractId: string
  email?: boolean
}): Promise<void> {
  if (!payload.email) return

  await enqueueJob(
    "contract.email.send",
    { contractId: payload.contractId },
    { jobId: `contract.email.send.${payload.contractId}` }
  )
}
