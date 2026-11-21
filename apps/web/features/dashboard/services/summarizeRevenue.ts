import { toCurrencyTotals, type CurrencyTotal } from "./currencyTotals"
import {
  isWithinWindow,
  startOfUtcMonth,
  startOfUtcYear,
  type DashboardWindow
} from "./dashboardPeriod"

export type RevenuePaymentRow = {
  amountCents: number
  currency: string
  paidAt: Date
}

export type RevenueSummary = {
  monthToDate: CurrencyTotal[]
  yearToDate: CurrencyTotal[]
  period: CurrencyTotal[]
}

// Revenue is money that arrived, so it is summed from `payments` and nothing else. An invoice's own
// totals record what was asked for; re-deriving revenue from them would report money that has not
// been received, and would double-count the moment a partial payment exists. Credit notes are
// deliberately not subtracted here either — a credit note cancels part of what is still owed, which
// is the receivable figure in summarizeReceivables.ts, not a payment that was already banked.
export function summarizeRevenue(
  rows: readonly RevenuePaymentRow[],
  now: Date,
  window: DashboardWindow
): RevenueSummary {
  const monthWindow: DashboardWindow = { start: startOfUtcMonth(now) }
  const yearWindow: DashboardWindow = { start: startOfUtcYear(now) }

  const monthToDate = new Map<string, number>()
  const yearToDate = new Map<string, number>()
  const period = new Map<string, number>()

  for (const row of rows) {
    if (isWithinWindow(row.paidAt, monthWindow)) addCents(monthToDate, row)
    if (isWithinWindow(row.paidAt, yearWindow)) addCents(yearToDate, row)
    if (isWithinWindow(row.paidAt, window)) addCents(period, row)
  }

  return {
    monthToDate: toCurrencyTotals(monthToDate),
    yearToDate: toCurrencyTotals(yearToDate),
    period: toCurrencyTotals(period)
  }
}

function addCents(totals: Map<string, number>, row: RevenuePaymentRow): void {
  totals.set(row.currency, (totals.get(row.currency) ?? 0) + row.amountCents)
}
