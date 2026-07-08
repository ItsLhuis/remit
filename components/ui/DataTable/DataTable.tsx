"use client"

import { type MouseEvent, type ReactNode } from "react"

import { flexRender, type Table as TanstackTable } from "@tanstack/react-table"

import { useTranslation } from "@/lib/i18n"

import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/Button"
import { ScrollArea } from "@/components/ui/ScrollArea"
import { Skeleton } from "@/components/ui/Skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/Table"

import { DataTablePagination } from "./DataTablePagination"

export type DataTableSelection<TData> = {
  selectedRows: TData[]
  clearSelection: () => void
}

type DataTableProps<TData> = {
  table: TanstackTable<TData>
  caption?: string
  onRowClick?: (row: TData) => void
  getRowClassName?: (row: TData) => string
  isLoading?: boolean
  skeletonRows?: number
  empty?: ReactNode
  actionBar?: (selection: DataTableSelection<TData>) => ReactNode
  pageSizeOptions?: number[]
  maxHeight?: number | string
  children?: ReactNode
  className?: string
}

const DataTable = <TData,>({
  table,
  caption,
  onRowClick,
  getRowClassName,
  isLoading = false,
  skeletonRows = 6,
  empty,
  actionBar,
  pageSizeOptions,
  maxHeight,
  children,
  className
}: DataTableProps<TData>) => {
  const { t } = useTranslation()

  const visibleColumnCount = table.getVisibleLeafColumns().length
  const rows = table.getRowModel().rows
  const selectedRows = table.getSelectedRowModel().rows.map((row) => row.original)
  const hasSelectionBar = Boolean(actionBar) && selectedRows.length > 0

  const clearSelection = () => table.resetRowSelection()

  const handleRowClick = (event: MouseEvent<HTMLTableRowElement>, row: TData) => {
    if (!onRowClick) return

    const target = event.target as HTMLElement

    if (
      target.closest('a, button, input, [role="menuitem"], [role="checkbox"], [data-no-row-click]')
    ) {
      return
    }

    onRowClick(row)
  }

  return (
    <div className={cn("ring-foreground/10 overflow-hidden rounded-xl ring-1", className)}>
      {children ? <div className="border-b p-3">{children}</div> : null}
      {hasSelectionBar ? (
        <section
          aria-label={t("common.table.selectedCount", { count: selectedRows.length })}
          className="bg-muted/40 flex flex-wrap items-center gap-2 border-b px-3 py-2"
        >
          <span className="text-sm font-medium">
            {t("common.table.selectedCount", { count: selectedRows.length })}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {actionBar?.({ selectedRows, clearSelection })}
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              {t("common.table.clearSelection")}
            </Button>
          </div>
        </section>
      ) : null}
      <div>
        <ScrollArea
          orientation="both"
          className="**:data-[slot=table-container]:overflow-visible"
          style={maxHeight !== undefined ? { maxHeight } : undefined}
        >
          <Table>
            {caption ? <caption className="sr-only">{caption}</caption> : null}
            <TableHeader className="bg-background sticky top-0 z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="bg-muted/40 hover:bg-muted/40">
                  {headerGroup.headers.map((header) => {
                    const sorted = header.column.getIsSorted()
                    const ariaSort = !header.column.getCanSort()
                      ? undefined
                      : sorted === "asc"
                        ? "ascending"
                        : sorted === "desc"
                          ? "descending"
                          : "none"

                    return (
                      <TableHead
                        key={header.id}
                        colSpan={header.colSpan}
                        aria-sort={ariaSort}
                        className={cn(
                          "text-muted-foreground h-9 text-xs font-medium",
                          header.column.columnDef.meta?.align === "end" && "text-right",
                          header.column.columnDef.meta?.headerClassName
                        )}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: skeletonRows }).map((_, rowIndex) => (
                  <TableRow key={`skeleton-${rowIndex}`} className="hover:bg-transparent">
                    {table.getVisibleLeafColumns().map((column) => (
                      <TableCell
                        key={`skeleton-cell-${column.id}`}
                        className={cn(
                          "py-2.5",
                          column.columnDef.meta?.align === "end" && "text-right",
                          column.columnDef.meta?.cellClassName
                        )}
                      >
                        {column.columnDef.meta?.skeleton ?? (
                          <Skeleton className="h-4 w-full max-w-48" />
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={visibleColumnCount} className="p-0">
                    {empty ?? (
                      <div className="text-muted-foreground p-8 text-center text-sm">
                        {t("common.table.noResults")}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() ? "selected" : undefined}
                    onClick={
                      onRowClick ? (event) => handleRowClick(event, row.original) : undefined
                    }
                    className={cn(
                      "data-[state=selected]:bg-muted/50",
                      onRowClick && "hover:bg-muted/40 cursor-pointer",
                      getRowClassName?.(row.original)
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          "py-2.5",
                          cell.column.columnDef.meta?.align === "end" && "text-right",
                          cell.column.columnDef.meta?.cellClassName
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
      <div className="border-t p-3">
        <DataTablePagination table={table} pageSizeOptions={pageSizeOptions} />
      </div>
    </div>
  )
}

export { DataTable }
