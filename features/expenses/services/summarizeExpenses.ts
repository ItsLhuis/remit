import { calculateRebillableCents } from "./expenseRebilling"

export type ExpenseAggregateRow = {
  amountCents: number
  currency: string
  rebillable: boolean
  markupPercentage: number | null
  invoicedInId: string | null
}

export type ExpensesAggregate = {
  count: number
  totalCentsByCurrency: Record<string, number>
  rebillableCentsByCurrency: Record<string, number>
  unbilledRebillableCentsByCurrency: Record<string, number>
}

// Kept per currency rather than summed into one number: an instance bills in whatever currencies its
// clients use, and adding cents across them would invent an exchange rate the app never holds.
export function summarizeExpenses(rows: ExpenseAggregateRow[]): ExpensesAggregate {
  const aggregate: ExpensesAggregate = {
    count: rows.length,
    totalCentsByCurrency: {},
    rebillableCentsByCurrency: {},
    unbilledRebillableCentsByCurrency: {}
  }

  for (const row of rows) {
    const rebillableCents = calculateRebillableCents(row)

    aggregate.totalCentsByCurrency[row.currency] =
      (aggregate.totalCentsByCurrency[row.currency] ?? 0) + row.amountCents

    aggregate.rebillableCentsByCurrency[row.currency] =
      (aggregate.rebillableCentsByCurrency[row.currency] ?? 0) + rebillableCents

    if (row.invoicedInId === null) {
      aggregate.unbilledRebillableCentsByCurrency[row.currency] =
        (aggregate.unbilledRebillableCentsByCurrency[row.currency] ?? 0) + rebillableCents
    }
  }

  return aggregate
}
