"use client"

import { useTranslation } from "@/lib/i18n"

import { exportTableToCsv } from "@/lib/utils"

import {
  Badge,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  DataTableDateFilter,
  DataTableFacetedFilter,
  DataTableRangeFilter,
  DataTableViewOptions,
  Icon,
  Input,
  Typography
} from "@/components/ui"

import { type Table } from "@/hooks"

import { type CreditNoteOverviewItem } from "../../types"

type CreditNotesOverviewToolbarProps = {
  table: Table<CreditNoteOverviewItem>
  rowCount: number
  search: string
  onSearchChange: (value: string) => void
  onReset: () => void
  hasClientOptions: boolean
}

const CreditNotesOverviewToolbar = ({
  table,
  rowCount,
  search,
  onSearchChange,
  onReset,
  hasClientOptions
}: CreditNotesOverviewToolbarProps) => {
  const { t } = useTranslation()

  const clientColumn = table.getColumn("client")
  const totalColumn = table.getColumn("total")
  const issuedAtColumn = table.getColumn("issuedAt")

  const columnFilterCount = table.getState().columnFilters.length
  const hasActiveFilters = search !== "" || columnFilterCount > 0

  return (
    <Collapsible defaultOpen={columnFilterCount > 0} className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-0.5">
          <Typography affects={["small", "medium"]}>
            {t("creditNotes.overview.tableTitle")}
          </Typography>
          <Typography affects={["muted", "tiny"]}>
            {t("creditNotes.overview.count", { count: rowCount })}
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
              placeholder={t("creditNotes.overview.searchPlaceholder")}
              aria-label={t("creditNotes.overview.searchLabel")}
              autoComplete="off"
              className="pl-8"
            />
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm">
              <Icon name="ListFilter" aria-hidden="true" />
              {t("creditNotes.overview.filters")}
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
            onClick={() => exportTableToCsv(table, { filename: "credit-notes" })}
          >
            <Icon name="Download" aria-hidden="true" />
            {t("common.table.export")}
          </Button>
          <DataTableViewOptions table={table} />
        </div>
      </div>
      <CollapsibleContent className="overflow-hidden">
        <div className="flex w-full flex-wrap items-center justify-end gap-2 border-t pt-3">
          {clientColumn && hasClientOptions ? (
            <DataTableFacetedFilter
              column={clientColumn}
              title={t("creditNotes.overview.clientColumn")}
            />
          ) : null}
          {totalColumn ? (
            <DataTableRangeFilter
              column={totalColumn}
              title={t("creditNotes.overview.totalColumn")}
            />
          ) : null}
          {issuedAtColumn ? (
            <DataTableDateFilter
              column={issuedAtColumn}
              title={t("creditNotes.overview.issuedColumn")}
            />
          ) : null}
          {hasActiveFilters ? (
            <Button variant="ghost" size="sm" onClick={onReset}>
              <Icon name="X" aria-hidden="true" />
              {t("creditNotes.overview.clearFilters")}
            </Button>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export { CreditNotesOverviewToolbar }
