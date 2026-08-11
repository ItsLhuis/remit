// The shape every report in this feature produces, so one table component and one CSV builder serve
// all seven of them. A cell carries its kind rather than a pre-formatted string because the same
// number has to reach a locale-aware renderer and a machine-readable CSV column, and only the
// producer knows which of the three it is.
export type ReportCell =
  | { kind: "money"; cents: number }
  | { kind: "count"; value: number }
  | { kind: "duration"; seconds: number }

export const REPORT_COLUMNS = [
  "invoiceCount",
  "invoiced",
  "credited",
  "netRevenue",
  "paid",
  "outstanding",
  "netTaxable",
  "netTax",
  "netGross",
  "entryCount",
  "hours",
  "billableValue",
  "expenseCount",
  "amount",
  "rebillableAmount",
  "taxableBase",
  "taxAmount",
  "creditedTaxable",
  "creditedTax",
  "netTaxDue"
] as const

export type ReportColumnId = (typeof REPORT_COLUMNS)[number]

export type ReportBucket = {
  key: string
  label: string
  sublabel: string | null
  currency: string
  cells: ReportCell[]
}

export type ReportRow = {
  key: string
  label: string
  sublabel: string | null
  cells: ReportCell[]
}

export type ReportCurrencyGroup = {
  currency: string
  rows: ReportRow[]
  totals: ReportCell[]
}

export type ReportResult = {
  columns: ReportColumnId[]
  groups: ReportCurrencyGroup[]
}

export type ReportRowOrder = "value" | "key"

// The currency rule for the whole feature, in one place: a bucket is keyed by (currency, key), and
// two buckets that differ only by currency stay two rows in two groups. Remit holds no exchange
// rates, so adding cents across currencies would be arithmetic on unlike units — the same reason
// `features/dashboard/services/currencyTotals.ts` never combines its own buckets. Totals are summed
// per group and never across groups, which is what makes a mixed-currency instance readable rather
// than silently wrong.
export function toReportResult(
  columns: readonly ReportColumnId[],
  buckets: readonly ReportBucket[],
  order: ReportRowOrder = "value"
): ReportResult {
  const groups = new Map<string, Map<string, ReportRow>>()

  for (const bucket of buckets) {
    const rows = groups.get(bucket.currency) ?? new Map<string, ReportRow>()
    const existing = rows.get(bucket.key)

    if (existing) {
      existing.cells = addCells(existing.cells, bucket.cells)
    } else {
      rows.set(bucket.key, {
        key: bucket.key,
        label: bucket.label,
        sublabel: bucket.sublabel,
        cells: bucket.cells
      })
    }

    groups.set(bucket.currency, rows)
  }

  return {
    columns: [...columns],
    groups: Array.from(groups.entries())
      .map(([currency, rows]) => {
        const sorted = sortRows(Array.from(rows.values()), order)

        return { currency, rows: sorted, totals: sumCells(sorted) }
      })
      .sort(compareGroups)
  }
}

export type ReportTableRow = ReportRow & { currency: string }

// The grouped result flattened back into one row list for the table, with each row carrying the
// currency it was grouped under. The grouping still decides the arithmetic — totals stay per group
// and are never combined — but the reader gets one paginated, sortable table instead of one table
// per currency, which is what keeps a thousand-row report from rendering a thousand rows at once.
export function toReportTableRows(result: ReportResult): ReportTableRow[] {
  return result.groups.flatMap((group) =>
    group.rows.map((row) => ({ ...row, currency: group.currency }))
  )
}

export function getCellValue(cell: ReportCell): number {
  if (cell.kind === "money") return cell.cents
  if (cell.kind === "duration") return cell.seconds

  return cell.value
}

export function countReportRows(result: ReportResult): number {
  return result.groups.reduce((total, group) => total + group.rows.length, 0)
}

function addCells(current: readonly ReportCell[], next: readonly ReportCell[]): ReportCell[] {
  return current.map((cell, index) => addCell(cell, next[index]))
}

function addCell(cell: ReportCell, other: ReportCell | undefined): ReportCell {
  if (!other) return cell

  if (cell.kind === "money") return { kind: "money", cents: cell.cents + getCellValue(other) }
  if (cell.kind === "duration") {
    return { kind: "duration", seconds: cell.seconds + getCellValue(other) }
  }

  return { kind: "count", value: cell.value + getCellValue(other) }
}

function sumCells(rows: readonly ReportRow[]): ReportCell[] {
  const first = rows[0]

  if (!first) return []

  return rows
    .slice(1)
    .reduce<ReportCell[]>((totals, row) => addCells(totals, row.cells), [...first.cells])
}

// Ranked by the first money column so the reader leads with where the money is, and by key when the
// dimension is itself ordered — a month report reads chronologically, not by size. Ties fall back to
// the label, which keeps the order stable for a given set of rows rather than dependent on insertion
// order.
function sortRows(rows: ReportRow[], order: ReportRowOrder): ReportRow[] {
  if (order === "key") return rows.toSorted((first, second) => first.key.localeCompare(second.key))

  const rankIndex = rows[0]?.cells.findIndex((cell) => cell.kind === "money") ?? -1

  if (rankIndex < 0) {
    return rows.toSorted((first, second) => first.label.localeCompare(second.label))
  }

  return rows.toSorted((first, second) => {
    const difference = getCellAt(second, rankIndex) - getCellAt(first, rankIndex)

    return difference !== 0 ? difference : first.label.localeCompare(second.label)
  })
}

function getCellAt(row: ReportRow, index: number): number {
  const cell = row.cells[index]

  return cell ? getCellValue(cell) : 0
}

function compareGroups(first: ReportCurrencyGroup, second: ReportCurrencyGroup): number {
  const difference = getGroupWeight(second) - getGroupWeight(first)

  return difference !== 0 ? difference : first.currency.localeCompare(second.currency)
}

function getGroupWeight(group: ReportCurrencyGroup): number {
  const total = group.totals.find((cell) => cell.kind === "money")

  return total ? getCellValue(total) : group.rows.length
}
