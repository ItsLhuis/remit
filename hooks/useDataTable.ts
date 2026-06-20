"use client"

import {
  type ReactNode,
  type TransitionStartFunction,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react"

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

import { getSortingStateParser } from "@/lib/utils"

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

const DEFAULT_PAGE_SIZE = 10
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
  columnVisibilityStorageKey?: string
  pageSizeStorageKey?: string
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
    clearOnDefault = false,
    startTransition,
    columnVisibilityStorageKey,
    pageSizeStorageKey,
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

  const [storedPageSize, setStoredPageSize] = useLocalStorage<number>(
    pageSizeStorageKey ?? null,
    initialState?.pagination?.pageSize ?? DEFAULT_PAGE_SIZE
  )

  const [page, setPage] = useQueryState(
    "page",
    parseAsInteger.withOptions(queryOptions).withDefault(1)
  )
  const [perPage, setPerPage] = useQueryState(
    "perPage",
    parseAsInteger.withOptions(queryOptions).withDefault(storedPageSize)
  )
  const [sorting, setSorting] = useQueryState(
    "sort",
    getSortingStateParser(columnIds)
      .withOptions(queryOptions)
      .withDefault(initialState?.sorting ?? [])
  )

  const pagination = useMemo<PaginationState>(
    () => ({ pageIndex: page - 1, pageSize: perPage }),
    [page, perPage]
  )

  const filterParsers = useMemo(() => {
    const parsers: Record<string, typeof filterValueParser> = {}

    for (const column of columns) {
      if (!column.enableColumnFilter) continue

      const id = getColumnId(column)

      if (id) parsers[id] = filterValueParser
    }

    return parsers
  }, [columns])

  const [filterValues, setFilterValues] = useQueryStates(filterParsers, queryOptions)

  const columnFilters = useMemo<ColumnFiltersState>(
    () =>
      Object.entries(filterValues).flatMap(([id, value]) =>
        value && value.length > 0 ? [{ id, value }] : []
      ),
    [filterValues]
  )

  const [columnVisibility, setColumnVisibility] = useLocalStorage<VisibilityState>(
    columnVisibilityStorageKey ?? null,
    initialState?.columnVisibility ?? {}
  )
  const [rowSelection, setRowSelection] = useState<RowSelectionState>(
    initialState?.rowSelection ?? {}
  )

  const syncedRef = useRef(false)

  useEffect(() => {
    if (syncedRef.current || !pageSizeStorageKey) return

    const urlParams = new URLSearchParams(window.location.search)

    if (urlParams.has("perPage")) {
      syncedRef.current = true
      return
    }

    if (storedPageSize !== DEFAULT_PAGE_SIZE) {
      void setPerPage(storedPageSize)
      syncedRef.current = true
    }
  }, [storedPageSize, pageSizeStorageKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const onPaginationChange = (updater: Updater<PaginationState>) => {
    const next = typeof updater === "function" ? updater(pagination) : updater

    void setPage(next.pageIndex + 1)
    void setPerPage(next.pageSize)

    setStoredPageSize(next.pageSize)
  }

  const onSortingChange = (updater: Updater<SortingState>) => {
    const next = typeof updater === "function" ? updater(sorting) : updater

    void setSorting(next)
  }

  const onColumnFiltersChange = (updater: Updater<ColumnFiltersState>) => {
    const next = typeof updater === "function" ? updater(columnFilters) : updater

    const updates: Record<string, string[] | null> = {}

    for (const id of Object.keys(filterParsers)) {
      const match = next.find((filter) => filter.id === id)

      updates[id] = match ? (match.value as string[]) : null
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
