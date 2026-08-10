const UPCOMING_WINDOW_DAYS = 30
const UPCOMING_LIMIT = 5
const MILLISECONDS_PER_DAY = 86_400_000

export type UpcomingInvoiceRow = {
  id: string
  number: string
  parentName: string
  currency: string
  dueDate: Date | null
  receivableCents: number
}

export type UpcomingInvoice = {
  id: string
  number: string
  parentName: string
  currency: string
  dueDate: Date
  receivableCents: number
  daysUntilDue: number
}

// Compares UTC day values rather than instants, matching `isInvoiceOverdue` in
// features/invoices/services/invoiceStatusView.ts so the two never disagree about the boundary
// between "due today" and "late". The window is inclusive at both ends: an invoice due today is
// still upcoming, and one due on the thirtieth day is the last one shown.
export function selectUpcomingInvoices(
  rows: readonly UpcomingInvoiceRow[],
  now: Date,
  days = UPCOMING_WINDOW_DAYS,
  limit = UPCOMING_LIMIT
): UpcomingInvoice[] {
  const today = toUtcDayValue(now)
  const upcoming: UpcomingInvoice[] = []

  for (const row of rows) {
    const { dueDate } = row

    if (!dueDate || row.receivableCents === 0) continue

    const daysUntilDue = Math.round((toUtcDayValue(dueDate) - today) / MILLISECONDS_PER_DAY)

    if (daysUntilDue < 0 || daysUntilDue > days) continue

    upcoming.push({ ...row, dueDate, daysUntilDue })
  }

  return upcoming.sort((first, second) => first.daysUntilDue - second.daysUntilDue).slice(0, limit)
}

function toUtcDayValue(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
}
