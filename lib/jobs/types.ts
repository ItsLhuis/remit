// The typed job catalog. A producer call is rejected by the compiler unless the name and payload
// appear here, mirroring `lib/events/types.ts` for the event bus.

// Which mail a rendered invoice is owed, carried on the render job so the chain needs no second
// lookup to know why the document was rendered.
export type InvoiceEmailOccasion = "sent" | "receipt" | "recurring_generated"

export type JobMap = {
  "proposal.pdf.render": {
    proposalId: string
    email?: boolean
  }
  "contract.pdf.render": {
    contractId: string
    email?: boolean
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
    email?: InvoiceEmailOccasion
  }
  "credit_note.pdf.render": {
    creditNoteId: string
  }
  // The document mails, chained *behind* the render above rather than sent alongside it. Stages 12
  // and 16 promise the PDF is attached, so the mail cannot go before the artifact exists.
  //
  // Two alternatives were rejected. Rendering inside the send job couples two failure domains: a
  // mail-provider outage would retry a Chromium launch five times. Sending without the attachment
  // after a timeout either breaks the promise silently or makes `email_logs.pdf_attached` a lie.
  //
  // Separate job names rather than a flag on the render, so a mail failure retries the send alone —
  // with the PDF already stored and no browser involved.
  "invoice.email.send": {
    invoiceId: string
    occasion: InvoiceEmailOccasion
  }
  "proposal.email.send": {
    proposalId: string
  }
  "contract.email.send": {
    contractId: string
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

// A runtime mirror of the catalog above, because `JobMap` is erased at compile time and the
// handler-coverage test needs something to iterate. The `Record<JobName, true>` annotation is what
// keeps the two in step: a name added to `JobMap` and forgotten here fails the compiler, so the test
// can never pass by checking a list that has quietly fallen behind — which is the exact drift that
// left five PDF job names unhandled.
const JOB_NAME_KEYS: Record<JobName, true> = {
  "proposal.pdf.render": true,
  "contract.pdf.render": true,
  "contract.signed_pdf.render": true,
  "invoice.pdf.render": true,
  "credit_note.pdf.render": true,
  "invoice.email.send": true,
  "proposal.email.send": true,
  "contract.email.send": true,
  "recurring.schedule.sweep": true,
  "recurring.invoice.generate": true,
  "data_export.assemble": true,
  "invoice.overdue.sweep": true,
  "invoice.reminder.sweep": true,
  "invoice.reminder.send": true
}

export const JOB_NAMES = Object.keys(JOB_NAME_KEYS) as JobName[]
