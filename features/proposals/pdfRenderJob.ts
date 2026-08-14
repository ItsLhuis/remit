import { and, eq, isNull } from "drizzle-orm"

import { writeAudit } from "@/lib/audit"

import { logger } from "@/lib/logger"

import { enqueueJob } from "@/lib/jobs"
import { renderHtmlToPdf, storeDocumentPdf } from "@/lib/pdf"

import { database } from "@/database"
import { proposals } from "@/database/schema"

import { buildProposalPdfDocument } from "./pdfDocument"

// The consumer half of ADR-0022 for proposals. Same shape as
// `features/invoices/pdfRenderJob.ts`, and deliberately a sibling rather than a shared generic: the
// three differ in which table they update, which audit event they write and what names their file,
// and a helper taking all of that as parameters would be longer than the duplication it removes
// (`architecture.md`, abstraction threshold).
//
// Rendered once and never regenerated. The stored PDF *is* the snapshot of what the client was sent,
// so a document that already has one is left alone — which also makes a retry after a partial run a
// no-op rather than a second object. The guard is the column, not the BullMQ job id, which is freed
// the moment the job completes.
export async function renderProposalPdf(payload: {
  proposalId: string
  email?: boolean
}): Promise<void> {
  const [existing] = await database
    .select({ pdfUploadId: proposals.pdfUploadId, number: proposals.number })
    .from(proposals)
    .where(eq(proposals.id, payload.proposalId))
    .limit(1)

  if (!existing) return

  // A document that already has its PDF still owes its email. The render is what is idempotent here,
  // not the send — `sendDocumentEmail` has its own durable guard — so returning early without
  // chaining would drop the mail whenever a render was retried after succeeding.
  if (existing.pdfUploadId) {
    await enqueueDocumentEmail(payload)

    return
  }

  const document = await buildProposalPdfDocument(payload.proposalId)

  // No template to render with is a configuration problem, not a transient one. Returning rather
  // than throwing keeps it out of the retry loop; `pdf_upload_id` stays NULL, which is what the UI
  // reads as "no PDF yet", and the audit entry is what tells the owner why.
  if (!document) {
    logger.error(
      { action: "renderProposalPdf", proposalId: payload.proposalId },
      "Proposal PDF skipped: no template to render"
    )

    await writeProposalPdfFailureAudit(payload.proposalId, "noTemplate")

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
      kind: "proposal",
      documentId: payload.proposalId,
      filename: `${existing.number}.pdf`
    })
  } catch (error) {
    // Never the rendered HTML or the bytes: the document carries the client's details and the
    // instance's payment information (`security.md`). The error and the id are enough to find it.
    logger.error(
      { action: "renderProposalPdf", proposalId: payload.proposalId, err: error },
      "Proposal PDF render failed"
    )

    await writeProposalPdfFailureAudit(payload.proposalId, "renderFailed")

    throw error
  }

  // Conditional on the pointer still being NULL, so two deliveries racing each other cannot leave
  // the document pointing at the loser's object.
  await database
    .update(proposals)
    .set({ pdfUploadId: uploadId })
    .where(and(eq(proposals.id, payload.proposalId), isNull(proposals.pdfUploadId)))

  await writeAudit("proposal.pdf_rendered", {
    actorUserId: null,
    targetEntityType: "proposal",
    targetEntityId: payload.proposalId,
    metadata: { uploadId },
    ipAddress: null,
    userAgent: null
  })

  await enqueueDocumentEmail(payload)
}

// Failure is recorded in the audit log rather than in a status column. `audit_log` is insert-only so
// a later success cannot erase the record of a failure, and a document with no `pdf_upload_id` is
// already unambiguous on screen — a parallel status column would only add a second thing to keep
// true.
async function writeProposalPdfFailureAudit(id: string, reason: string): Promise<void> {
  await writeAudit("proposal.pdf_render_failed", {
    actorUserId: null,
    targetEntityType: "proposal",
    targetEntityId: id,
    metadata: { reason },
    ipAddress: null,
    userAgent: null
  })
}

// The chain from ADR-0022's artifact to the mail that carries it. Enqueued only after the pointer is
// linked, so the send job always finds a PDF to attach.
async function enqueueDocumentEmail(payload: {
  proposalId: string
  email?: boolean
}): Promise<void> {
  if (!payload.email) return

  await enqueueJob(
    "proposal.email.send",
    { proposalId: payload.proposalId },
    { jobId: `proposal.email.send.${payload.proposalId}` }
  )
}
