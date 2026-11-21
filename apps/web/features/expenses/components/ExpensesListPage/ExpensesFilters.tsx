"use client"

import { useTranslation } from "@/lib/i18n"

import {
  Badge,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  DataTableDateFilter,
  DataTableFacetedFilter,
  DataTableViewOptions,
  Icon,
  Input,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Typography
} from "@/components/ui"

import { type Table } from "@/hooks"

import { type ExpenseStatusFilter } from "../../schemas"
import { type ExpenseListItem } from "../../types"

function asStatus(value: string): ExpenseStatusFilter {
  return value === "deleted" || value === "all" ? value : "active"
}

// A faceted filter over an empty option list offers the reader nothing to choose, and every one of
// these lists is built from what the instance has actually recorded. Reading the count off the
// column the filter already receives keeps that decision here rather than as four booleans the page
// has to thread down.
function hasOptions(column: ReturnType<Table<ExpenseListItem>["getColumn"]>): boolean {
  return (column?.columnDef.meta?.options?.length ?? 0) > 0
}

type ExpensesFiltersProps = {
  table: Table<ExpenseListItem>
  rowCount: number
  search: string
  status: ExpenseStatusFilter
  hasActiveFilters: boolean
  activeFilterCount: number
  isExporting: boolean
  onSearchChange: (value: string) => void
  onStatusChange: (value: ExpenseStatusFilter) => void
  onExport: () => void
  onReset: () => void
}

const ExpensesFilters = ({
  table,
  rowCount,
  search,
  status,
  hasActiveFilters,
  activeFilterCount,
  isExporting,
  onSearchChange,
  onStatusChange,
  onExport,
  onReset
}: ExpensesFiltersProps) => {
  const { t } = useTranslation()

  const spentAtColumn = table.getColumn("spentAt")
  const categoryColumn = table.getColumn("category")
  const projectColumn = table.getColumn("project")
  const clientColumn = table.getColumn("client")
  const currencyColumn = table.getColumn("currency")
  const rebillableColumn = table.getColumn("rebillable")
  const invoicedColumn = table.getColumn("invoiced")

  return (
    <Collapsible defaultOpen={activeFilterCount > 0} className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-0.5">
          <Typography affects={["small", "medium"]}>{t("expenses.list.tableTitle")}</Typography>
          <Typography affects={["muted", "tiny"]}>
            {t("expenses.list.count", { count: rowCount })}
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
              placeholder={t("expenses.filters.searchPlaceholder")}
              aria-label={t("expenses.filters.search")}
              autoComplete="off"
              className="pl-8"
            />
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm">
              <Icon name="ListFilter" aria-hidden="true" />
              {t("expenses.filters.title")}
              {activeFilterCount > 0 ? (
                <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                  {activeFilterCount}
                </Badge>
              ) : null}
            </Button>
          </CollapsibleTrigger>
          <Button variant="outline" size="sm" disabled={isExporting} onClick={onExport}>
            {isExporting ? <Spinner /> : <Icon name="Download" aria-hidden="true" />}
            {t("expenses.actions.export")}
          </Button>
          <DataTableViewOptions table={table} />
        </div>
      </div>
      <CollapsibleContent className="overflow-hidden">
        <div className="flex w-full flex-wrap items-center justify-end gap-2 border-t pt-3">
          <Select value={status} onValueChange={(value) => onStatusChange(asStatus(value))}>
            <SelectTrigger size="sm" className="w-32" aria-label={t("expenses.filters.status")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="active">{t("expenses.status.active")}</SelectItem>
                <SelectItem value="deleted">{t("expenses.status.deleted")}</SelectItem>
                <SelectItem value="all">{t("expenses.status.all")}</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          {categoryColumn && hasOptions(categoryColumn) ? (
            <DataTableFacetedFilter column={categoryColumn} title={t("expenses.fields.category")} />
          ) : null}
          {projectColumn && hasOptions(projectColumn) ? (
            <DataTableFacetedFilter column={projectColumn} title={t("expenses.fields.project")} />
          ) : null}
          {clientColumn && hasOptions(clientColumn) ? (
            <DataTableFacetedFilter column={clientColumn} title={t("expenses.fields.client")} />
          ) : null}
          {currencyColumn && hasOptions(currencyColumn) ? (
            <DataTableFacetedFilter column={currencyColumn} title={t("expenses.fields.currency")} />
          ) : null}
          {rebillableColumn ? (
            <DataTableFacetedFilter
              column={rebillableColumn}
              title={t("expenses.fields.rebillable")}
            />
          ) : null}
          {invoicedColumn ? (
            <DataTableFacetedFilter column={invoicedColumn} title={t("expenses.fields.invoiced")} />
          ) : null}
          {spentAtColumn ? (
            <DataTableDateFilter column={spentAtColumn} title={t("expenses.fields.spentAt")} />
          ) : null}
          {hasActiveFilters ? (
            <Button variant="ghost" size="sm" onClick={onReset}>
              <Icon name="X" aria-hidden="true" />
              {t("expenses.filters.reset")}
            </Button>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export { ExpensesFilters }
