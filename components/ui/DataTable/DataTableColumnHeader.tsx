"use client"

import { type ComponentProps } from "react"

import { type Column } from "@tanstack/react-table"

import { useTranslation } from "@/lib/i18n"

import { cn } from "@/lib/utils"

import { Icon } from "@/components/ui/Icon"

type DataTableColumnHeaderProps<TData, TValue> = {
  column: Column<TData, TValue>
  title: string
} & ComponentProps<"div">

const DataTableColumnHeader = <TData, TValue>({
  column,
  title,
  className,
  ...props
}: DataTableColumnHeaderProps<TData, TValue>) => {
  const { t } = useTranslation()

  const align = column.columnDef.meta?.align

  if (!column.getCanSort()) {
    return (
      <div className={cn(align === "end" && "text-right", className)} {...props}>
        {title}
      </div>
    )
  }

  const sorted = column.getIsSorted()

  return (
    <div className={cn(align === "end" && "flex justify-end", className)} {...props}>
      <button
        type="button"
        onClick={column.getToggleSortingHandler()}
        className={cn(
          "text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 -mx-1.5 inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 transition-colors outline-none focus-visible:ring-[3px]",
          align === "end" && "flex-row-reverse",
          sorted && "text-foreground"
        )}
      >
        {title}
        <Icon
          name={sorted === "asc" ? "ArrowUp" : sorted === "desc" ? "ArrowDown" : "ChevronsUpDown"}
          className={cn("size-3.5", !sorted && "opacity-50")}
          aria-hidden="true"
        />
        <span className="sr-only">
          {sorted === "asc" ? t("common.table.sortDescending") : t("common.table.sortAscending")}
        </span>
      </button>
    </div>
  )
}

export { DataTableColumnHeader }
