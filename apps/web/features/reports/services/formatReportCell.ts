import { formatCurrency, formatHours, formatNumber } from "@/lib/utils"

import { getCellValue, type ReportCell } from "./reportTable"

// The locale-aware half of the contract `reportTable.ts` describes: a cell carries its kind because
// only its producer knows which of the three it is, and this is where that kind becomes something a
// person reads. `buildReportCsvRows` is the machine-readable half and deliberately does not come
// through here — a spreadsheet wants an unformatted number, a reader wants a currency symbol.
//
// Shared rather than duplicated because there are now three readers of the same rendering — the
// table columns, the totals band, and the PDF document — and a money figure formatted three
// slightly different ways in one product is a defect the reader has to reconcile.
export function formatReportCell(
  cell: ReportCell | undefined,
  currency: string,
  locale: string
): string {
  if (!cell) return ""
  if (cell.kind === "money") return formatCurrency(cell.cents, currency, locale)
  if (cell.kind === "duration") return formatHours(cell.seconds, locale)

  return formatNumber(getCellValue(cell), locale)
}
