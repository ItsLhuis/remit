"use client"

import { useTranslation } from "@/lib/i18n"

import { type DataTableInstance, type DataTableRowData } from "@/lib/utils"

import { Button } from "@/components/ui/Button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from "@/components/ui/DropdownMenu"
import { Icon } from "@/components/ui/Icon"

type DataTableViewOptionsProps<TData extends DataTableRowData> = {
  table: DataTableInstance<TData>
}

const DataTableViewOptions = <TData extends DataTableRowData>({
  table
}: DataTableViewOptionsProps<TData>) => {
  const { t } = useTranslation()

  const columns = table
    .getAllColumns()
    .filter((column) => typeof column.accessorFn !== "undefined" && column.getCanHide())

  if (columns.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Icon name="SlidersHorizontal" aria-hidden="true" />
          {t("common.table.columns")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>{t("common.table.toggleColumns")}</DropdownMenuLabel>
        {columns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.id}
            checked={column.getIsVisible()}
            onCheckedChange={(checked) => column.toggleVisibility(Boolean(checked))}
            onSelect={(event) => event.preventDefault()}
          >
            {column.columnDef.meta?.label ?? column.id}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { DataTableViewOptions }
