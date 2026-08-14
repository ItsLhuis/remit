import { and, eq, isNull } from "drizzle-orm"

import { writeAudit } from "@/lib/audit"

import { logger } from "@/lib/logger"

import { renderHtmlToPdf, storeDocumentPdf } from "@/lib/pdf"

import { database } from "@/database"
import { creditNotes } from "@/database/schema"

import { buildCreditNotePdfDocument } from "./pdfDocument"

// The consumer half of ADR-0022 for credit notes. Same shape as
// `features/invoices/pdfRenderJob.ts`, and deliberately a sibling rather than a shared generic: the
// three differ in which table they update, which audit event they write and what names their file,
// and a helper taking all of that as parameters would be longer than the duplication it removes
// (`architecture.md`, abstraction threshold).
//
// Rendered once and never regenerated. The stored PDF *is* the snapshot of what the client was sent,
// so a document that already has one is left alone — which also makes a retry after a partial run a
// no-op rather than a second object. The guard is the column, not the BullMQ job id, which is freed
// the moment the job completes.
export async function renderCreditNotePdf(payload: { creditNoteId: string }): Promise<void> {
  const [existing] = await database
    .select({ pdfUploadId: creditNotes.pdfUploadId, number: creditNotes.number })
    .from(creditNotes)
    .where(eq(creditNotes.id, payload.creditNoteId))
    .limit(1)

  if (!existing || existing.pdfUploadId) return

  const document = await buildCreditNotePdfDocument(payload.creditNoteId)

  // No template to render with is a configuration problem, not a transient one. Returning rather
  // than throwing keeps it out of the retry loop; `pdf_upload_id` stays NULL, which is what the UI
  // reads as "no PDF yet", and the audit entry is what tells the owner why.
  if (!document) {
    logger.error(
      { action: "renderCreditNotePdf", creditNoteId: payload.creditNoteId },
      "Credit note PDF skipped: no template to render"
    )

    await writeCreditNotePdfFailureAudit(payload.creditNoteId, "noTemplate")

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
      kind: "credit_note",
      documentId: payload.creditNoteId,
      filename: `${existing.number}.pdf`
    })
  } catch (error) {
    // Never the rendered HTML or the bytes: the document carries the client's details and the
    // instance's payment information (`security.md`). The error and the id are enough to find it.
    logger.error(
      { action: "renderCreditNotePdf", creditNoteId: payload.creditNoteId, err: error },
      "Credit note PDF render failed"
    )

    await writeCreditNotePdfFailureAudit(payload.creditNoteId, "renderFailed")

    throw error
  }

  // Conditional on the pointer still being NULL, so two deliveries racing each other cannot leave
  // the document pointing at the loser's object.
  await database
    .update(creditNotes)
    .set({ pdfUploadId: uploadId })
    .where(and(eq(creditNotes.id, payload.creditNoteId), isNull(creditNotes.pdfUploadId)))

  await writeAudit("credit_note.pdf_rendered", {
    actorUserId: null,
    targetEntityType: "credit_note",
    targetEntityId: payload.creditNoteId,
    metadata: { uploadId },
    ipAddress: null,
    userAgent: null
  })
}

// Failure is recorded in the audit log rather than in a status column. `audit_log` is insert-only so
// a later success cannot erase the record of a failure, and a document with no `pdf_upload_id` is
// already unambiguous on screen — a parallel status column would only add a second thing to keep
// true.
async function writeCreditNotePdfFailureAudit(id: string, reason: string): Promise<void> {
  await writeAudit("credit_note.pdf_render_failed", {
    actorUserId: null,
    targetEntityType: "credit_note",
    targetEntityId: id,
    metadata: { reason },
    ipAddress: null,
    userAgent: null
  })
}
