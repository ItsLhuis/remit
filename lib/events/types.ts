export type EventMap = {
  "auth.login.succeeded": {
    userId: string
    ipAddress: string
    userAgent: string
  }
  "auth.login.failed": {
    email: string
    ipAddress: string
    userAgent: string
  }
  "auth.password.changed": {
    userId: string
    ipAddress: string
    userAgent: string
  }
  "auth.totp.reconfigured": {
    userId: string
    ipAddress: string
    userAgent: string
  }
  "auth.backup_code.consumed": {
    userId: string
    ipAddress: string
    userAgent: string
  }
  "settings.email.configured": {
    userId: string
  }
  "settings.payment.configured": {
    userId: string
  }
  "settings.security.changed": {
    userId: string
    field: string
  }
  "client.created": {
    clientId: string
    userId: string
  }
  "client.updated": {
    clientId: string
    userId: string
    changedFields: string[]
  }
  "client.deleted": {
    clientId: string
    userId: string
  }
  "lead.created": {
    leadId: string
    userId: string
  }
  "lead.updated": {
    leadId: string
    userId: string
    changedFields: string[]
  }
  "lead.deleted": {
    leadId: string
    userId: string
  }
  "lead.stage_changed": {
    leadId: string
    userId: string
    from: string
    to: string
  }
  "lead.converted": {
    leadId: string
    userId: string
    clientId: string
  }
  "project.created": {
    projectId: string
    userId: string
  }
  "project.updated": {
    projectId: string
    userId: string
    changedFields: string[]
  }
  "project.deleted": {
    projectId: string
    userId: string
  }
  "project.status_changed": {
    projectId: string
    userId: string
    from: string
    to: string
  }
  "task.created": {
    taskId: string
    projectId: string
    userId: string
  }
  "task.updated": {
    taskId: string
    projectId: string
    userId: string
    changedFields: string[]
  }
  "task.deleted": {
    taskId: string
    projectId: string
    userId: string
  }
  "task.status_changed": {
    taskId: string
    projectId: string
    userId: string
    from: string
    to: string
  }
  "proposal.created": {
    proposalId: string
    projectId: string | null
    clientId: string | null
    userId: string
  }
  "proposal.updated": {
    proposalId: string
    projectId: string | null
    clientId: string | null
    userId: string
    changedFields: string[]
  }
  "proposal.sent": {
    proposalId: string
    projectId: string | null
    clientId: string | null
    userId: string
  }
  "proposal.deleted": {
    proposalId: string
    projectId: string | null
    clientId: string | null
    userId: string
  }
  "proposal.accepted": {
    proposalId: string
    projectId: string | null
  }
  "proposal.rejected": {
    proposalId: string
    projectId: string | null
  }
  "contract.created": {
    contractId: string
    projectId: string | null
    clientId: string | null
    userId: string
  }
  "contract.updated": {
    contractId: string
    userId: string
    changedFields: string[]
  }
  "contract.sent": {
    contractId: string
    userId: string
  }
  // No `userId`: signing happens anonymously through `/c/[token]`, so the actor is the signature
  // row itself rather than a logged-in user.
  "contract.signed": {
    contractId: string
    signatureId: string
  }
  "contract.terminated": {
    contractId: string
    userId: string
  }
  "contract.deleted": {
    contractId: string
    userId: string
  }
  // `userId` is nullable because an invoice is not always raised by a person: the recurring-schedule
  // generation job creates one as the system actor, with no session behind it. Same reasoning as
  // `invoice.paid` and `payment.received` below.
  "invoice.created": {
    invoiceId: string
    projectId: string | null
    clientId: string | null
    userId: string | null
  }
  "invoice.updated": {
    invoiceId: string
    userId: string
    changedFields: string[]
  }
  // Nullable for the same reason as `invoice.created`: a schedule with `auto_send` set issues the
  // invoice straight to `sent` from the job, where no user is present.
  "invoice.sent": {
    invoiceId: string
    userId: string | null
  }
  // The payload deliberately carries no amount, so a full-settlement write and a payment
  // aggregation reaching the total can emit the same event. `userId` is nullable because the
  // aggregation can also be reached by the Stripe webhook, where no user is present.
  "invoice.paid": {
    invoiceId: string
    userId: string | null
  }
  // Emitted once per payment row created, whichever writer created it. `userId` is null for a
  // payment recorded by the Stripe receiver.
  "payment.received": {
    paymentId: string
    invoiceId: string
    userId: string | null
  }
  "invoice.deleted": {
    invoiceId: string
    userId: string
  }
  // Emitted once per invoice per crossing of its due date, by the overdue-detection job — never by a
  // request. `overdue` is a derived status that is never written to `invoices.status`, so this event
  // is the only moment the transition is observable; a subscriber that misses it cannot recover the
  // fact from the row, only re-derive the condition. `daysOverdue` is whole UTC days.
  "invoice.overdue": {
    invoiceId: string
    clientId: string | null
    daysOverdue: number
  }
  // Emitted at most once per invoice, by the same nightly sweep that announces the crossing, and
  // only when a fee was actually written. `feeCents` is the amount charged after the policy cap, and
  // it has already been added into `invoices.total_cents` by the time a subscriber sees this.
  "invoice.late_fee_applied": {
    invoiceId: string
    clientId: string | null
    feeCents: number
    daysLate: number
  }
  // `offsetDays` and `phase` together identify which entry of the settings reminder arrays this
  // dispatch corresponds to, which is also the idempotency key the job guards on.
  "invoice.reminder_sent": {
    invoiceId: string
    offsetDays: number
    phase: "before" | "after"
  }
  // No `userId`: a schedule generates on its own timetable, and the person who created it may be
  // long gone. `occurrence` is the 1-based index of the run within the schedule, so a subscriber can
  // tell "first invoice of this retainer" from "the ninth" without re-reading the counter.
  "recurring.invoice_generated": {
    recurringInvoiceId: string
    invoiceId: string
    clientId: string
    projectId: string | null
    occurrence: number
  }
  // Fires on the run that first consumes the pool, not on every run afterwards. It crosses the
  // boundary because the freelancer needs to know their client is now billing at the overage rate,
  // and nothing on the invoice says so.
  "retainer.pool_exhausted": {
    recurringInvoiceId: string
    clientId: string
    includedHours: number
    consumedHours: number
  }
  // A credit note is issued at creation — there is no draft state to leave — so this is the only
  // "created" event the document has. It crosses the boundary because what an invoice is still owed
  // moves the moment it fires, and no subscriber can derive that from the invoice row alone: the
  // stored totals deliberately never change (see services/effectiveReceivable.ts).
  "credit_note.issued": {
    creditNoteId: string
    invoiceId: string
    userId: string
  }
  "credit_note.deleted": {
    creditNoteId: string
    invoiceId: string
    userId: string
  }
  // Emitted only once an entry has an end, never when a timer starts, because a running timer has no
  // duration and nothing outside the feature can act on it. It crosses the boundary because a
  // completed billable entry is what makes unbilled work exist for invoicing to draw on, and that
  // fact is otherwise only visible by re-querying `time_entries.invoiced_in_id IS NULL`.
  "time.logged": {
    timeEntryId: string
    projectId: string
    taskId: string | null
    userId: string
    durationSeconds: number
    billable: boolean
  }
  // Emitted on creation rather than on some later "ready to bill" moment, because an expense has no
  // draft state: the row exists and is immediately a cost the instance has borne. It crosses the
  // boundary because a rebillable one becomes something the next invoice for that project should
  // carry, which is otherwise only visible by re-querying `expenses.invoiced_in_id IS NULL`.
  "expense.created": {
    expenseId: string
    projectId: string | null
    clientId: string | null
    userId: string
    rebillable: boolean
  }
  // None of the four membership events carry the invitation id. It is the bearer credential for
  // `/invite/[invitationId]`, and an event payload reaches every subscriber and any log line one of
  // them writes; the invited email identifies the invitation for anything that needs to react.
  "member.invited": {
    email: string
    role: string
    userId: string
  }
  "member.accepted": {
    memberId: string
    userId: string
    role: string
  }
  "member.removed": {
    memberId: string
    userId: string
    removedByUserId: string
  }
  "invitation.canceled": {
    email: string
    role: string
    userId: string
  }
  "template.created": {
    templateId: string
    userId: string
  }
  "template.updated": {
    templateId: string
    userId: string
    changedFields: string[]
  }
  "template.deleted": {
    templateId: string
    userId: string
  }
}
