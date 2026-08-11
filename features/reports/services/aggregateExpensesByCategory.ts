import { toReportResult, type ReportColumnId, type ReportResult } from "./reportTable"

// `rebillableCents` is resolved by the caller through `calculateRebillableCents` from
// features/expenses, so the markup a report totals is the same arithmetic the expense list shows.
export type ExpenseReportRow = {
  category: string
  currency: string
  amountCents: number
  rebillableCents: number
}

export const EXPENSE_REPORT_COLUMNS: ReportColumnId[] = [
  "expenseCount",
  "amount",
  "rebillableAmount"
]

export function aggregateExpensesByCategory(rows: readonly ExpenseReportRow[]): ReportResult {
  return toReportResult(
    EXPENSE_REPORT_COLUMNS,
    rows.map((row) => ({
      key: row.category,
      label: row.category,
      sublabel: null,
      currency: row.currency,
      cells: [
        { kind: "count" as const, value: 1 },
        { kind: "money" as const, cents: row.amountCents },
        { kind: "money" as const, cents: row.rebillableCents }
      ]
    }))
  )
}
