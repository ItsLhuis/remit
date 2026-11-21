import { toCurrencyTotals, type CurrencyTotal } from "./currencyTotals"
import { isWithinWindow, type DashboardWindow } from "./dashboardPeriod"

export type ExpenseSpendRow = {
  amountCents: number
  currency: string
  spentAt: Date
}

export type ExpenseSpendSummary = {
  period: CurrencyTotal[]
  count: number
}

// Gross spend, not the rebillable slice: the dashboard answers "what did this business cost to
// run", so an expense that will later be billed on to a client still left the account today.
// `features/expenses/services/summarizeExpenses.ts` is the surface that splits rebillable from
// unbilled, and it is deliberately not reused here because it aggregates a different question.
export function summarizeExpenseSpend(
  rows: readonly ExpenseSpendRow[],
  window: DashboardWindow
): ExpenseSpendSummary {
  const totals = new Map<string, number>()

  let count = 0

  for (const row of rows) {
    if (!isWithinWindow(row.spentAt, window)) continue

    totals.set(row.currency, (totals.get(row.currency) ?? 0) + row.amountCents)
    count += 1
  }

  return { period: toCurrencyTotals(totals), count }
}
