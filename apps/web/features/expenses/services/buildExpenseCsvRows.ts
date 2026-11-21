import { formatCentsForInput } from "@/lib/utils"

import { calculateRebillableCents } from "./expenseRebilling"

export type ExpenseCsvRow = {
  spentAt: Date
  category: string
  description: string
  projectName: string | null
  clientName: string | null
  amountCents: number
  currency: string
  rebillable: boolean
  markupPercentage: number | null
  invoicedInId: string | null
  receiptFilename: string | null
}

export type ExpenseCsvHeaders = {
  spentAt: string
  category: string
  description: string
  project: string
  client: string
  amount: string
  currency: string
  rebillable: string
  markupPercentage: string
  rebillableAmount: string
  invoiced: string
  receipt: string
}

export type ExpenseCsvBooleanLabels = {
  yes: string
  no: string
}

export type BuildExpenseCsvRowsInput = {
  expenses: ExpenseCsvRow[]
  headers: ExpenseCsvHeaders
  booleans: ExpenseCsvBooleanLabels
}

// Values are written machine-readable, not display-formatted: an ISO day, a plain decimal amount and
// a separate ISO 4217 column. A locale-formatted "1.234,50 €" would carry its own decimal separator
// and currency symbol into the cell, which every spreadsheet then imports as text rather than as a
// number, and the export exists to be summed. The day is read off the UTC instant rather than local
// getters because `expenses.spent_at` is a `date` column that Drizzle hands back as UTC midnight.
export function buildExpenseCsvRows({
  expenses,
  headers,
  booleans
}: BuildExpenseCsvRowsInput): string[][] {
  const headerRow = [
    headers.spentAt,
    headers.category,
    headers.description,
    headers.project,
    headers.client,
    headers.amount,
    headers.currency,
    headers.rebillable,
    headers.markupPercentage,
    headers.rebillableAmount,
    headers.invoiced,
    headers.receipt
  ]

  const rows = expenses.map((expense) => [
    expense.spentAt.toISOString().slice(0, 10),
    expense.category,
    expense.description,
    expense.projectName ?? "",
    expense.clientName ?? "",
    formatCentsForInput(expense.amountCents),
    expense.currency,
    expense.rebillable ? booleans.yes : booleans.no,
    expense.markupPercentage === null ? "" : String(expense.markupPercentage),
    formatCentsForInput(calculateRebillableCents(expense)),
    expense.invoicedInId ? booleans.yes : booleans.no,
    expense.receiptFilename ?? ""
  ])

  return [headerRow, ...rows]
}
