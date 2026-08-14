import { and, eq, isNull } from "drizzle-orm"

import { writeAudit } from "@/lib/audit"

import { logger } from "@/lib/logger"

import { enqueueJob, type InvoiceEmailOccasion } from "@/lib/jobs"
import { renderHtmlToPdf, storeDocumentPdf } from "@/lib/pdf"

import { database } from "@/database"
import { invoices } from "@/database/schema"

import { buildInvoicePdfDocument } from "./pdfDocument"

// The consumer half of ADR-0022 for invoices, split out of `jobs.ts` because it answers a different
// question: that file decides which invoices are late or owed a reminder, this one turns one invoice
// into a stored document. `jobs.ts` still owns the registration, so there remains a single place
// listing what this feature handles.
//
// Rendering is a job and never a request: a headless Chromium launch costs a second and hundreds of
// megabytes, which is not something a user action can wait on.
//
// Rendered once and never regenerated. The stored PDF *is* the snapshot of what the client was sent
// (`pdf_upload_id` in `database/schema/invoices.ts`), so an invoice that already has one is left
// alone — which also makes a retry after a partial run a no-op rather than a second object. The
// guard is the column, not the BullMQ job id, which is freed the moment the job completes.
export async function renderInvoicePdf(payload: {
  invoiceId: string
  email?: InvoiceEmailOccasion
}): Promise<void> {
  const [existing] = await database
    .select({ pdfUploadId: invoices.pdfUploadId, number: invoices.number })
    .from(invoices)
    .where(eq(invoices.id, payload.invoiceId))
    .limit(1)

  if (!existing) return

  // A document that already has its PDF still owes its email. The render is what is idempotent here,
  // not the send — `sendDocumentEmail` has its own durable guard — so returning early without
  // chaining would drop the mail whenever a render was retried after succeeding.
  if (existing.pdfUploadId) {
    await enqueueInvoiceEmail(payload)

    return
  }

  const document = await buildInvoicePdfDocument(payload.invoiceId)

  // No template to render with is a configuration problem, not a transient one. Returning rather
  // than throwing keeps it out of the retry loop; `pdf_upload_id` stays NULL, which is the same
  // thing the UI reads as "no PDF yet", and the audit entry is what tells the owner why.
  if (!document) {
    logger.error(
      { action: "renderInvoicePdf", invoiceId: payload.invoiceId },
      "Invoice PDF skipped: no template to render"
    )

    await writeInvoicePdfFailureAudit(payload.invoiceId, "noTemplate")

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
      kind: "invoice",
      documentId: payload.invoiceId,
      filename: `${existing.number}.pdf`
    })
  } catch (error) {
    // Never the rendered HTML or the bytes: the document carries the client's details and the
    // instance's payment information (`security.md`). The error and the invoice id are enough to
    // find it.
    logger.error(
      { action: "renderInvoicePdf", invoiceId: payload.invoiceId, err: error },
      "Invoice PDF render failed"
    )

    await writeInvoicePdfFailureAudit(payload.invoiceId, "renderFailed")

    throw error
  }

  // Conditional on the pointer still being NULL, so two deliveries racing each other cannot leave
  // the invoice pointing at the loser's object.
  await database
    .update(invoices)
    .set({ pdfUploadId: uploadId })
    .where(and(eq(invoices.id, payload.invoiceId), isNull(invoices.pdfUploadId)))

  await writeAudit("invoice.pdf_rendered", {
    actorUserId: null,
    targetEntityType: "invoice",
    targetEntityId: payload.invoiceId,
    metadata: { uploadId },
    ipAddress: null,
    userAgent: null
  })

  await enqueueInvoiceEmail(payload)
}

// The chain from ADR-0022's artifact to the mail that carries it. Enqueued only after the pointer is
// linked, so the send job always finds a PDF to attach.
async function enqueueInvoiceEmail(payload: {
  invoiceId: string
  email?: InvoiceEmailOccasion
}): Promise<void> {
  if (!payload.email) return

  await enqueueJob(
    "invoice.email.send",
    { invoiceId: payload.invoiceId, occasion: payload.email },
    { jobId: `invoice.email.send.${payload.invoiceId}.${payload.email}` }
  )
}

// Failure is recorded in the audit log rather than in a status column on `invoices`. The vocabulary
// already exists, `audit_log` is insert-only so a later success cannot erase the record of a
// failure, and a document with no `pdf_upload_id` is already unambiguous on screen — a parallel
// status column would only add a second thing to keep true.
async function writeInvoicePdfFailureAudit(invoiceId: string, reason: string): Promise<void> {
  await writeAudit("invoice.pdf_render_failed", {
    actorUserId: null,
    targetEntityType: "invoice",
    targetEntityId: invoiceId,
    metadata: { reason },
    ipAddress: null,
    userAgent: null
  })
}
