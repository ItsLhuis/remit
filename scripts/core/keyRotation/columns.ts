import type { EncryptedColumn } from "@/database/schema/helpers"

export type EncryptedTable = {
  table: string
  columns: string[]
}

export function groupEncryptedColumns(columns: ReadonlyArray<EncryptedColumn>): EncryptedTable[] {
  const grouped = new Map<string, string[]>()

  for (const { table, column } of columns) {
    const existing = grouped.get(table)

    if (existing) {
      existing.push(column)
      continue
    }

    grouped.set(table, [column])
  }

  return Array.from(grouped.entries())
    .map(([table, tableColumns]) => ({
      table,
      columns: [...tableColumns].sort((left, right) => left.localeCompare(right))
    }))
    .sort((left, right) => left.table.localeCompare(right.table))
}
