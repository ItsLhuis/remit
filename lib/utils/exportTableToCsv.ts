import { type Table } from "@tanstack/react-table"

type ExportTableToCsvOptions = {
  filename?: string
  excludeColumns?: string[]
}

export function exportTableToCsv<TData>(
  table: Table<TData>,
  options: ExportTableToCsvOptions = {}
): void {
  const { filename = "export", excludeColumns = [] } = options

  const columns = table
    .getVisibleLeafColumns()
    .filter((column) => column.accessorFn !== undefined && !excludeColumns.includes(column.id))

  const headers = columns.map((column) => column.columnDef.meta?.label ?? column.id)

  const body = table
    .getRowModel()
    .rows.map((row) => columns.map((column) => escapeCsvValue(row.getValue(column.id))).join(","))

  const csv = [headers.map(escapeCsvValue).join(","), ...body].join("\n")

  downloadCsv(csv, `${filename}.csv`)
}

function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return ""

  const text =
    value instanceof Date
      ? value.toISOString()
      : typeof value === "string"
        ? value
        : typeof value === "number" || typeof value === "boolean" || typeof value === "bigint"
          ? String(value)
          : JSON.stringify(value)

  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`

  return text
}

function downloadCsv(csv: string, filename: string): void {
  if (typeof document === "undefined") return

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")

  link.href = url
  link.download = filename
  link.click()

  URL.revokeObjectURL(url)
}
