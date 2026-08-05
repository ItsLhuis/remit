"use client"

import { useTranslation } from "@/lib/i18n"

import { exportTableToCsv } from "@/lib/utils"

import { Button, DataTableFacetedFilter, DataTableViewOptions, Icon, Input } from "@/components/ui"

import { type Table } from "@/hooks"

import { type RecurringInvoiceListItem } from "../../types"

type RecurringInvoicesOverviewToolbarProps = {
  table: Table<RecurringInvoiceListItem>
  search: string
  onSearchChange: (value: string) => void
  onReset: () => void
  hasClientOptions: boolean
}

const RecurringInvoicesOverviewToolbar = ({
  table,
  search,
  onSearchChange,
  onReset,
  hasClientOptions
}: RecurringInvoicesOverviewToolbarProps) => {
  const { t } = useTranslation()

  const statusColumn = table.getColumn("status")
  const cadenceColumn = table.getColumn("cadence")
  const clientColumn = table.getColumn("client")

  const hasActiveFilters = search !== "" || table.getState().columnFilters.length > 0

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-72">
          <Icon
            name="Search"
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t("recurringInvoices.list.searchPlaceholder")}
            aria-label={t("recurringInvoices.list.searchPlaceholder")}
            autoComplete="off"
            className="pl-8"
          />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportTableToCsv(table, { filename: "recurring-invoices" })}
          >
            <Icon name="Download" aria-hidden="true" />
            {t("common.table.export")}
          </Button>
          <DataTableViewOptions table={table} />
        </div>
      </div>
      <div className="flex w-full flex-wrap items-center justify-end gap-2 border-t pt-3">
        {statusColumn ? (
          <DataTableFacetedFilter
            column={statusColumn}
            title={t("recurringInvoices.filters.status")}
          />
        ) : null}
        {cadenceColumn ? (
          <DataTableFacetedFilter
            column={cadenceColumn}
            title={t("recurringInvoices.filters.cadence")}
          />
        ) : null}
        {clientColumn && hasClientOptions ? (
          <DataTableFacetedFilter
            column={clientColumn}
            title={t("recurringInvoices.filters.client")}
          />
        ) : null}
        {hasActiveFilters ? (
          <Button variant="ghost" size="sm" onClick={onReset}>
            <Icon name="X" aria-hidden="true" />
            {t("recurringInvoices.filters.clear")}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export { RecurringInvoicesOverviewToolbar }
