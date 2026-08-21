"use client"

import { type ReactNode, type TransitionStartFunction, useEffect, useMemo, useState } from "react"

import {
  type ColumnDef,
  type ColumnFiltersState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type RowData,
  type RowSelectionState,
  type SortingState,
  type Table,
  type TableOptions,
  type TableState,
  type Updater,
  useReactTable,
  type VisibilityState
} from "@tanstack/react-table"

import { parseAsArrayOf, parseAsInteger, parseAsString, useQueryState, useQueryStates } from "nuqs"

import { DEFAULT_PAGE_SIZE, getSortingStateParser } from "@/lib/utils"

import { useLocalStorage } from "./useLocalStorage"

declare module "@tanstack/react-table" {
  // Module augmentation requires `interface`; `type` cannot merge into the library declaration.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-definitions
  interface ColumnMeta<TData extends RowData, TValue> {
    label?: string
    variant?: DataTableFilterVariant
    options?: DataTableFilterOption[]
    align?: "start" | "end"
    headerClassName?: string
    cellClassName?: string
    skeleton?: ReactNode
  }
}

type DataTableFilterVariant = "text" | "multiSelect" | "range" | "date"

type DataTableFilterOption = {
  label: string
  value: string
  count?: number
  icon?: string
}

const ARRAY_SEPARATOR = ","

const filterValueParser = parseAsArrayOf(parseAsString, ARRAY_SEPARATOR)

export type UseDataTableOptions<TData> = Omit<
  TableOptions<TData>,
  | "state"
  | "pageCount"
  | "getCoreRowModel"
  | "manualPagination"
  | "manualSorting"
  | "manualFiltering"
  | "getRowId"
> & {
  getRowId: (row: TData, index: number) => string
  rowCount?: number
  pageCount?: number
  shallow?: boolean
  clearOnDefault?: boolean
  startTransition?: TransitionStartFunction
  // Prefix for this table's `page`, `perPage`, `sort`, and per-column filter query parameters.
  // Two tables rendered by the same route otherwise share those keys, so paginating one paginates
  // the other; give every table beyond the route's primary one a prefix (e.g. `"contact_"`).
  urlKeyPrefix?: string
  columnVisibilityStorageKey?: string
  initialState?: Omit<Partial<TableState>, "sorting"> & { sorting?: SortingState }
}

export function useDataTable<TData>(options: UseDataTableOptions<TData>): { table: Table<TData> } {
  const {
    columns,
    getRowId,
    rowCount,
    pageCount,
    initialState,
    shallow = true,
    clearOnDefault = true,
    startTransition,
    urlKeyPrefix = "",
    columnVisibilityStorageKey,
    ...tableOptions
  } = options

  const isServerSide = rowCount !== undefined || pageCount !== undefined

  const queryOptions = useMemo(
    () => ({ shallow, clearOnDefault, startTransition }),
    [shallow, clearOnDefault, startTransition]
  )

  const columnIds = useMemo(
    () => new Set(columns.map(getColumnId).filter((id): id is string => Boolean(id))),
    [columns]
  )

  const [page, setPage] = useQueryState(
    `${urlKeyPrefix}page`,
    parseAsInteger.withOptions(queryOptions).withDefault(1)
  )
  const [perPage, setPerPage] = useQueryState(
    `${urlKeyPrefix}perPage`,
    parseAsInteger.withOptions(queryOptions).withDefault(DEFAULT_PAGE_SIZE)
  )
  const [sorting, setSorting] = useQueryState(
    `${urlKeyPrefix}sort`,
    getSortingStateParser(columnIds)
      .withOptions(queryOptions)
      .withDefault(initialState?.sorting ?? [])
  )

  const pagination = useMemo<PaginationState>(
    () => ({ pageIndex: page - 1, pageSize: perPage }),
    [page, perPage]
  )

  // Column id on the table side, prefixed query parameter on the URL side. Every hop between the
  // two goes through this map, so a prefixed table filters under its own keys without the column
  // ids TanStack sees ever carrying the prefix.
  const filterKeysByColumnId = useMemo(() => {
    const keys = new Map<string, string>()

    for (const column of columns) {
      if (!column.enableColumnFilter) continue

      const id = getColumnId(column)

      if (id) keys.set(id, `${urlKeyPrefix}${id}`)
    }

    return keys
  }, [columns, urlKeyPrefix])

  const filterParsers = useMemo(() => {
    const parsers: Record<string, typeof filterValueParser> = {}

    for (const key of filterKeysByColumnId.values()) parsers[key] = filterValueParser

    return parsers
  }, [filterKeysByColumnId])

  const [filterValues, setFilterValues] = useQueryStates(filterParsers, queryOptions)

  const columnFilters = useMemo<ColumnFiltersState>(
    () =>
      [...filterKeysByColumnId].flatMap(([id, key]) => {
        const value = filterValues[key]

        return value && value.length > 0 ? [{ id, value }] : []
      }),
    [filterKeysByColumnId, filterValues]
  )

  const [columnVisibility, setColumnVisibility] = useLocalStorage<VisibilityState>(
    columnVisibilityStorageKey ?? null,
    initialState?.columnVisibility ?? {}
  )
  const [rowSelection, setRowSelection] = useState<RowSelectionState>(
    initialState?.rowSelection ?? {}
  )

  // Server-side pagination never clamps the page on its own, so a page that points past the end of
  // the result set (after deletions or a newly applied filter) would render an empty table. Snap the
  // page back into range whenever the row count or page size shrinks the available pages.
  useEffect(() => {
    if (rowCount === undefined) return

    const lastPage = Math.max(1, Math.ceil(rowCount / perPage))

    if (page > lastPage) void setPage(lastPage)
  }, [rowCount, perPage, page, setPage])

  const onPaginationChange = (updater: Updater<PaginationState>) => {
    const next = typeof updater === "function" ? updater(pagination) : updater

    const pageSizeChanged = next.pageSize !== pagination.pageSize

    void setPage(pageSizeChanged ? 1 : next.pageIndex + 1)
    void setPerPage(next.pageSize)
  }

  const onSortingChange = (updater: Updater<SortingState>) => {
    const next = typeof updater === "function" ? updater(sorting) : updater

    void setPage(1)
    void setSorting(next)
  }

  const onColumnFiltersChange = (updater: Updater<ColumnFiltersState>) => {
    const next = typeof updater === "function" ? updater(columnFilters) : updater

    const updates: Record<string, string[] | null> = {}

    const filtersById = new Map(next.map((filter) => [filter.id, filter]))

    for (const [id, key] of filterKeysByColumnId) {
      const match = filtersById.get(id)

      updates[key] = match ? (match.value as string[]) : null
    }

    void setPage(1)
    void setFilterValues(updates)
  }

  // TanStack Table's builder-pattern state reads aren't visible to React Compiler, so it cannot
  // safely memoize this hook. Memoization is intentionally skipped; the warning is expected here.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    ...tableOptions,
    columns,
    getRowId,
    state: { pagination, sorting, columnVisibility, rowSelection, columnFilters },
    rowCount,
    pageCount: pageCount ?? (rowCount !== undefined ? Math.ceil(rowCount / perPage) : undefined),
    manualPagination: isServerSide,
    manualSorting: isServerSide,
    manualFiltering: isServerSide,
    autoResetPageIndex: !isServerSide,
    enableRowSelection: tableOptions.enableRowSelection ?? true,
    onPaginationChange,
    onSortingChange,
    onColumnFiltersChange,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel()
  })

  return { table }
}

function getColumnId<TData>(column: ColumnDef<TData>): string | undefined {
  return column.id ?? ("accessorKey" in column ? String(column.accessorKey) : undefined)
}

export type { ColumnDef, Table } from "@tanstack/react-table"
