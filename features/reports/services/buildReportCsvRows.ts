import { formatCentsForInput, toHundredthHours } from "@/lib/utils"

import { type ReportCell, type ReportResult } from "./reportTable"

export type ReportCsvHeaders = {
  label: string
  sublabel: string
  currency: string
  columns: string[]
  total: string
}

// Values are written machine-readable, not display-formatted, for the same reason
// features/expenses/services/buildExpenseCsvRows.ts writes its own: a locale-formatted "1.234,50 €"
// carries a decimal separator and a symbol that every spreadsheet imports as text, and a report
// exists to be summed. The currency is its own column so a mixed-currency export stays groupable
// after it leaves Remit — the rows are never combined here either.
//
// Each currency group contributes its rows and then its own total row, so the file reconciles per
// currency without the reader re-deriving it. Escaping is applied by `serializeCsv` in lib/utils.
export function buildReportCsvRows(result: ReportResult, headers: ReportCsvHeaders): string[][] {
  const headerRow = [headers.label, headers.sublabel, headers.currency, ...headers.columns]

  const body = result.groups.flatMap((group) => [
    ...group.rows.map((row) => [
      row.label,
      row.sublabel ?? "",
      group.currency,
      ...row.cells.map(toCsvCell)
    ]),
    [headers.total, "", group.currency, ...group.totals.map(toCsvCell)]
  ])

  return [headerRow, ...body]
}

function toCsvCell(cell: ReportCell): string {
  if (cell.kind === "money") return formatCentsForInput(cell.cents)
  if (cell.kind === "duration") return formatCentsForInput(toHundredthHours(cell.seconds))

  return String(cell.value)
}
