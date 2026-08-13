// The typed job catalog. A producer call is rejected by the compiler unless the name and payload
// appear here, mirroring `lib/events/types.ts` for the event bus.
export type JobMap = {
  "proposal.pdf.render": {
    proposalId: string
  }
  "contract.pdf.render": {
    contractId: string
  }
  // Distinct from `contract.pdf.render`: this one renders the executed document with the signature
  // record embedded, and carries the signature row the worker writes `signed_pdf_upload_id` back to
  // once the PDF is stored (ADR-0022).
  "contract.signed_pdf.render": {
    contractId: string
    signatureId: string
  }
  "invoice.pdf.render": {
    invoiceId: string
  }
  "credit_note.pdf.render": {
    creditNoteId: string
  }
  // The three sweeps below are the repeatable jobs registered in `schedules.ts`; they carry no
  // payload because their input is "whatever the database says is due right now". Each one only
  // selects work and fans it out, so a sweep that runs twice costs a duplicate query and nothing
  // else — the money-affecting half is always a separate per-entity job with its own guard.
  "recurring.schedule.sweep": Record<string, never>
  // `occurrenceKey` is the schedule's `next_run_at` as an ISO day at the moment the sweep saw it.
  // It is not read by the handler, which re-derives due-ness from the row under a lock; it exists to
  // make the BullMQ job id deterministic per occurrence so a sweep repeated inside one period does
  // not queue the same generation twice.
  "recurring.invoice.generate": {
    recurringInvoiceId: string
    occurrenceKey: string
  }
  // Carries only the `data_exports` row id: the scope, the client, and the requester all live on that
  // row, and re-reading them under a conditional claim is what makes a duplicate delivery a no-op
  // instead of a second archive.
  "data_export.assemble": {
    exportId: string
  }
  "invoice.overdue.sweep": Record<string, never>
  "invoice.reminder.sweep": Record<string, never>
  "invoice.reminder.send": {
    invoiceId: string
    // Days relative to the due date, always positive; `phase` carries the direction. Splitting them
    // keeps the value aligned with the `reminder_before_due_days` / `reminder_after_due_days`
    // settings arrays it is drawn from, which are both non-negative.
    offsetDays: number
    phase: "before" | "after"
  }
}

export type JobName = keyof JobMap
