import { type ReactNode } from "react"

import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_arrIncludes,
  filterFn_equals,
  filterFn_inDateRange,
  filterFn_includesString,
  filterFn_inNumberRange,
  filterFn_weakEquals,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  type CellData,
  type Column,
  type ColumnDef,
  type ReactTable,
  type RowData,
  type SortingState
} from "@tanstack/react-table"

import { createParser } from "nuqs"

import { z } from "zod"

export type DataTableFilterVariant = "text" | "multiSelect" | "range" | "date"

export type DataTableFilterOption = {
  label: string
  value: string
  count?: number
  icon?: string
}

export type DataTableColumnMeta = {
  label?: string
  variant?: DataTableFilterVariant
  options?: DataTableFilterOption[]
  align?: "start" | "end"
  headerClassName?: string
  cellClassName?: string
  skeleton?: ReactNode
}

export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100

// A type-only slot: Tanstack discards the value and reads its type as every column's `meta`.
const columnMeta: DataTableColumnMeta = {}

// Every data table in Remit shares this feature set, so a column or a table component written for
// one fits all of them. The registries hold what a column's "auto" filter and sort resolve to,
// which is all any column here uses.
export const dataTableFeatures = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
  filterFns: {
    arrIncludes: filterFn_arrIncludes,
    equals: filterFn_equals,
    inDateRange: filterFn_inDateRange,
    includesString: filterFn_includesString,
    inNumberRange: filterFn_inNumberRange,
    weakEquals: filterFn_weakEquals
  },
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
    text: sortFn_text
  },
  columnMeta
})

export type DataTableFeatures = typeof dataTableFeatures

export type DataTableRowData = RowData

export type DataTableColumnDef<
  TData extends RowData,
  TValue extends CellData = CellData
> = ColumnDef<DataTableFeatures, TData, TValue>

export type DataTableColumn<TData extends RowData, TValue = unknown> = Column<
  DataTableFeatures,
  TData,
  TValue
>

export type DataTableInstance<TData extends RowData> = ReactTable<DataTableFeatures, TData>

const sortingItemSchema = z.object({
  id: z.string(),
  desc: z.boolean()
})

export function getSortingStateParser(columnIds?: Set<string>) {
  return createParser<SortingState>({
    parse: (value) => {
      try {
        const parsed: unknown = JSON.parse(value)
        const result = z.array(sortingItemSchema).safeParse(parsed)

        if (!result.success) return null

        // Sort ids arrive from the URL and end up naming an order-by column, so an id outside the
        // caller's known column set invalidates the whole parse rather than being dropped: a
        // partially honoured sort would silently reorder a table by something the user never chose.
        if (columnIds && result.data.some((item) => !columnIds.has(item.id))) return null

        return result.data
      } catch {
        return null
      }
    },
    serialize: (value) => JSON.stringify(value),
    eq: (a, b) =>
      a.length === b.length &&
      a.every((item, index) => item.id === b[index]?.id && item.desc === b[index]?.desc)
  })
}
