import { type Table } from "@tanstack/react-table"

import { downloadCsv, serializeCsv } from "./csv"

type ExportTableToCsvOptions = {
  filename?: string
  excludeColumns?: string[]
}

export function exportTableToCsv<TData>(
  table: Table<TData>,
  options: ExportTableToCsvOptions = {}
): void {
  const { filename = "export", excludeColumns = [] } = options

  const excludedColumnIds = new Set(excludeColumns)

  const columns = table
    .getVisibleLeafColumns()
    .filter((column) => column.accessorFn !== undefined && !excludedColumnIds.has(column.id))

  const headers = columns.map((column) => column.columnDef.meta?.label ?? column.id)

  const body = table
    .getRowModel()
    .rows.map((row) => columns.map((column) => row.getValue(column.id)))

  downloadCsv(serializeCsv([headers, ...body]), `${filename}.csv`)
}
