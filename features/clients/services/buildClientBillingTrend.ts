const BILLING_TREND_MONTHS = 6

export type ClientInvoiceTrendRow = {
  createdAt: Date
  totalCents: number
}

export type ClientTrendCountRow = {
  createdAt: Date
}

export type ClientBillingTrendInput = {
  invoices: readonly ClientInvoiceTrendRow[]
  projects: readonly ClientTrendCountRow[]
  recurringInvoices: readonly ClientTrendCountRow[]
}

export type ClientBillingPoint = {
  month: string
  billedCents: number
  invoiceCount: number
  projectCount: number
  recurringCount: number
}

export function buildClientBillingTrend(
  input: ClientBillingTrendInput,
  now: Date,
  months = BILLING_TREND_MONTHS
): ClientBillingPoint[] {
  const buckets: ClientBillingPoint[] = []

  let year = now.getUTCFullYear()
  let month = now.getUTCMonth()

  for (let index = 0; index < months; index += 1) {
    const start = Date.UTC(year, month, 1)
    const end = Date.UTC(year, month + 1, 1)

    let billedCents = 0
    let invoiceCount = 0

    for (const row of input.invoices) {
      const createdAt = row.createdAt.getTime()

      if (createdAt >= start && createdAt < end) {
        billedCents += row.totalCents
        invoiceCount += 1
      }
    }

    buckets.unshift({
      month: `${year}-${String(month + 1).padStart(2, "0")}`,
      billedCents,
      invoiceCount,
      projectCount: countCreatedInRange(input.projects, start, end),
      recurringCount: countCreatedInRange(input.recurringInvoices, start, end)
    })

    month -= 1

    if (month < 0) {
      month = 11
      year -= 1
    }
  }

  return buckets
}

function countCreatedInRange(
  rows: readonly ClientTrendCountRow[],
  start: number,
  end: number
): number {
  let total = 0

  for (const row of rows) {
    const createdAt = row.createdAt.getTime()

    if (createdAt >= start && createdAt < end) total += 1
  }

  return total
}
