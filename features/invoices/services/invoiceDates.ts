export type InvoiceIssueDatesInput = {
  now: Date
  currentIssueDate: Date | null
  currentDueDate: Date | null
  paymentTermsDays: number
}

export type InvoiceIssueDates = {
  issueDate: Date
  dueDate: Date
}

// The dates a send stamps onto an invoice, resolved together because `chk_invoices_dates` constrains
// them as a pair. Both are date-only and UTC-constructed per money-and-dates.md: an issue date is a
// calendar day, and deriving it from local time would file an invoice under the previous day for any
// instance west of UTC.
//
// A draft may already carry either date, chosen by hand. An existing issue date is always kept — it
// is the date on the document the client will read. An existing due date is kept only while it is
// not earlier than the issue date; a stale one is recomputed from payment terms, because leaving it
// would push the constraint violation down into the database and fail the send there instead.
export function resolveInvoiceIssueDates({
  now,
  currentIssueDate,
  currentDueDate,
  paymentTermsDays
}: InvoiceIssueDatesInput): InvoiceIssueDates {
  const issueDate = toUtcDay(currentIssueDate ?? now)

  if (currentDueDate) {
    const dueDate = toUtcDay(currentDueDate)

    if (dueDate.getTime() >= issueDate.getTime()) return { issueDate, dueDate }
  }

  const dueDate = new Date(issueDate)

  dueDate.setUTCDate(dueDate.getUTCDate() + Math.max(paymentTermsDays, 0))

  return { issueDate, dueDate }
}

function toUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
}
