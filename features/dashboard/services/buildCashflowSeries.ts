const CASHFLOW_MONTHS = 12

export type CashflowRow = {
  occurredAt: Date
  amountCents: number
}

export type CashflowInput = {
  revenue: readonly CashflowRow[]
  expenses: readonly CashflowRow[]
}

export type CashflowPoint = {
  month: string
  revenueCents: number
  expenseCents: number
}

// Twelve zero-filled UTC month buckets ending with the current one, so a month with no activity
// still draws a gap in the chart rather than collapsing the axis. Callers narrow the rows to a
// single currency first: the series is one currency's cashflow, never a sum across several.
export function buildCashflowSeries(
  input: CashflowInput,
  now: Date,
  months = CASHFLOW_MONTHS
): CashflowPoint[] {
  const buckets: CashflowPoint[] = []

  let year = now.getUTCFullYear()
  let month = now.getUTCMonth()

  for (let index = 0; index < months; index += 1) {
    // `month + 1` is allowed to reach 12: Date.UTC rolls it into January of the next year, which is
    // exactly the half-open bucket end wanted. The backwards step below cannot lean on the same
    // rollover because it must also carry the year, so it decrements explicitly.
    const start = Date.UTC(year, month, 1)
    const end = Date.UTC(year, month + 1, 1)

    buckets.unshift({
      month: `${year}-${String(month + 1).padStart(2, "0")}`,
      revenueCents: sumInRange(input.revenue, start, end),
      expenseCents: sumInRange(input.expenses, start, end)
    })

    month -= 1

    if (month < 0) {
      month = 11
      year -= 1
    }
  }

  return buckets
}

function sumInRange(rows: readonly CashflowRow[], start: number, end: number): number {
  let total = 0

  for (const row of rows) {
    const occurredAt = row.occurredAt.getTime()

    if (occurredAt >= start && occurredAt < end) total += row.amountCents
  }

  return total
}
