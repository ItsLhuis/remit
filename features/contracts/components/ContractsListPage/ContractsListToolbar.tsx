"use client"

import { useTranslation } from "@/lib/i18n"

import { exportTableToCsv } from "@/lib/utils"

import {
  Badge,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  DataTableFacetedFilter,
  DataTableViewOptions,
  Icon,
  Input,
  Typography
} from "@/components/ui"

import { type Table } from "@/hooks"

import { type ContractListItem } from "../../types"

type ContractsListToolbarProps = {
  table: Table<ContractListItem>
  rowCount: number
  search: string
  onSearchChange: (value: string) => void
  onReset: () => void
  hasClientOptions: boolean
}

const ContractsListToolbar = ({
  table,
  rowCount,
  search,
  onSearchChange,
  onReset,
  hasClientOptions
}: ContractsListToolbarProps) => {
  const { t } = useTranslation()

  const statusColumn = table.getColumn("status")
  const clientColumn = table.getColumn("client")

  const columnFilterCount = table.getState().columnFilters.length
  const hasActiveFilters = search !== "" || columnFilterCount > 0

  return (
    <Collapsible defaultOpen={columnFilterCount > 0} className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-0.5">
          <Typography affects={["small", "medium"]}>{t("contracts.title")}</Typography>
          <Typography affects={["muted", "tiny"]}>
            {t("contracts.filters.count", { count: rowCount })}
          </Typography>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="relative w-full sm:w-64">
            <Icon
              name="Search"
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={t("contracts.filters.searchPlaceholder")}
              aria-label={t("contracts.filters.searchLabel")}
              autoComplete="off"
              className="pl-8"
            />
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm">
              <Icon name="ListFilter" aria-hidden="true" />
              {t("contracts.filters.statusFilter")}
              {columnFilterCount > 0 ? (
                <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                  {columnFilterCount}
                </Badge>
              ) : null}
            </Button>
          </CollapsibleTrigger>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportTableToCsv(table, { filename: "contracts" })}
          >
            <Icon name="Download" aria-hidden="true" />
            {t("common.table.export")}
          </Button>
          <DataTableViewOptions table={table} />
        </div>
      </div>
      <CollapsibleContent className="overflow-hidden">
        <div className="flex w-full flex-wrap items-center justify-end gap-2 border-t pt-3">
          {statusColumn ? (
            <DataTableFacetedFilter
              column={statusColumn}
              title={t("contracts.table.statusColumn")}
            />
          ) : null}
          {clientColumn && hasClientOptions ? (
            <DataTableFacetedFilter column={clientColumn} title={t("contracts.fields.client")} />
          ) : null}
          {hasActiveFilters ? (
            <Button variant="ghost" size="sm" onClick={onReset}>
              <Icon name="X" aria-hidden="true" />
              {t("contracts.filters.clearFilters")}
            </Button>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export { ContractsListToolbar }
