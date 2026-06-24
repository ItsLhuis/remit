"use client"

import { type ComponentProps } from "react"

import { type Table } from "@tanstack/react-table"

import { useTranslation } from "@/lib/i18n"

import { cn, MAX_PAGE_SIZE } from "@/lib/utils"

import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"
import { IconButton } from "@/components/ui/IconButton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/Select"
import { Typography } from "@/components/ui/Typography"

const PAGE_SIZE_OPTIONS = Array.from({ length: Math.ceil(MAX_PAGE_SIZE / 10) }, (_, index) =>
  Math.min((index + 1) * 10, MAX_PAGE_SIZE)
)

type DataTablePaginationProps<TData> = {
  table: Table<TData>
  pageSizeOptions?: number[]
} & ComponentProps<"div">

const DataTablePagination = <TData,>({
  table,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  className,
  ...props
}: DataTablePaginationProps<TData>) => {
  const { t } = useTranslation()

  const { pageIndex, pageSize } = table.getState().pagination
  const pageCount = Math.max(table.getPageCount(), 1)
  const currentPage = pageIndex + 1
  const selectedCount = table.getFilteredSelectedRowModel().rows.length
  const totalCount = table.getRowCount()

  const pageItems = getPageItems(currentPage, pageCount)

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-between gap-3 text-sm sm:flex-row",
        className
      )}
      {...props}
    >
      <Typography affects={["muted", "small"]} aria-live="polite" className="whitespace-nowrap">
        {t("common.table.rowsSelectedOfTotal", { selected: selectedCount, total: totalCount })}
      </Typography>
      <div className="flex items-center gap-1">
        <IconButton
          variant="ghost"
          size="icon-sm"
          label={t("common.table.goToFirstPage")}
          onClick={() => table.setPageIndex(0)}
          disabled={!table.getCanPreviousPage()}
        >
          <Icon name="ChevronsLeft" />
        </IconButton>
        <IconButton
          variant="ghost"
          size="icon-sm"
          label={t("common.table.goToPreviousPage")}
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          <Icon name="ChevronLeft" />
        </IconButton>
        {pageItems.map((item, index) =>
          item === "ellipsis" ? (
            <span
              key={`ellipsis-${index}`}
              aria-hidden="true"
              className="text-muted-foreground flex size-7 items-center justify-center"
            >
              <Icon name="MoreHorizontal" className="size-4" />
            </span>
          ) : (
            <Button
              key={item}
              variant={item === currentPage ? "outline" : "ghost"}
              size="icon-sm"
              aria-label={t("common.table.goToPage", { page: item })}
              aria-current={item === currentPage ? "page" : undefined}
              className="font-normal tabular-nums"
              onClick={() => table.setPageIndex(item - 1)}
            >
              {item}
            </Button>
          )
        )}
        <IconButton
          variant="ghost"
          size="icon-sm"
          label={t("common.table.goToNextPage")}
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          <Icon name="ChevronRight" />
        </IconButton>
        <IconButton
          variant="ghost"
          size="icon-sm"
          label={t("common.table.goToLastPage")}
          onClick={() => table.setPageIndex(pageCount - 1)}
          disabled={!table.getCanNextPage()}
        >
          <Icon name="ChevronsRight" />
        </IconButton>
      </div>
      <div className="flex items-center gap-2">
        <Typography affects={["muted", "small"]} className="whitespace-nowrap">
          {t("common.table.rowsPerPage")}
        </Typography>
        <Select value={`${pageSize}`} onValueChange={(value) => table.setPageSize(Number(value))}>
          <SelectTrigger size="sm" className="w-[4.5rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map((option) => (
              <SelectItem key={option} value={`${option}`}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

function getPageItems(currentPage: number, pageCount: number): (number | "ellipsis")[] {
  const boundaryCount = 1
  const siblingCount = 1
  const totalSlots = boundaryCount * 2 + siblingCount * 2 + 3

  if (pageCount <= totalSlots) {
    return Array.from({ length: pageCount }, (_, index) => index + 1)
  }

  const left = Math.max(currentPage - siblingCount, boundaryCount + 2)
  const right = Math.min(currentPage + siblingCount, pageCount - boundaryCount - 1)

  const items: (number | "ellipsis")[] = []

  for (let page = 1; page <= boundaryCount; page++) items.push(page)

  if (left > boundaryCount + 2) items.push("ellipsis")
  else for (let page = boundaryCount + 1; page < left; page++) items.push(page)

  for (let page = left; page <= right; page++) items.push(page)

  if (right < pageCount - boundaryCount - 1) items.push("ellipsis")
  else for (let page = right + 1; page <= pageCount - boundaryCount; page++) items.push(page)

  for (let page = pageCount - boundaryCount + 1; page <= pageCount; page++) items.push(page)

  return items
}

export { DataTablePagination }
