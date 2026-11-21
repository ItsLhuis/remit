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
  DataTableViewOptions,
  Icon,
  Input,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Typography
} from "@/components/ui"

import { type Table } from "@/hooks"

import { type TimeEntryStatusFilter } from "../../schemas"
import { type TimeEntryListItem } from "../../types"

function asStatus(value: string): TimeEntryStatusFilter {
  return value === "deleted" || value === "all" ? value : "active"
}

type TimeTrackingFiltersProps = {
  table: Table<TimeEntryListItem>
  rowCount: number
  search: string
  status: TimeEntryStatusFilter
  hasProjects: boolean
  hasTasks: boolean
  hasActiveFilters: boolean
  activeFilterCount: number
  onSearchChange: (value: string) => void
  onStatusChange: (value: TimeEntryStatusFilter) => void
  onReset: () => void
}

const TimeTrackingFilters = ({
  table,
  rowCount,
  search,
  status,
  hasProjects,
  hasTasks,
  hasActiveFilters,
  activeFilterCount,
  onSearchChange,
  onStatusChange,
  onReset
}: TimeTrackingFiltersProps) => {
  const { t } = useTranslation()

  const startedColumn = table.getColumn("started")
  const projectColumn = table.getColumn("project")
  const taskColumn = table.getColumn("task")
  const billableColumn = table.getColumn("billable")
  const invoicedColumn = table.getColumn("invoiced")

  return (
    <Collapsible defaultOpen={activeFilterCount > 0} className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-0.5">
          <Typography affects={["small", "medium"]}>{t("timeTracking.list.tableTitle")}</Typography>
          <Typography affects={["muted", "tiny"]}>
            {t("timeTracking.list.count", { count: rowCount })}
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
              placeholder={t("timeTracking.filters.searchPlaceholder")}
              aria-label={t("timeTracking.filters.search")}
              autoComplete="off"
              className="pl-8"
            />
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm">
              <Icon name="ListFilter" aria-hidden="true" />
              {t("timeTracking.filters.title")}
              {activeFilterCount > 0 ? (
                <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                  {activeFilterCount}
                </Badge>
              ) : null}
            </Button>
          </CollapsibleTrigger>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportTableToCsv(table, { filename: "time-entries" })}
          >
            <Icon name="Download" aria-hidden="true" />
            {t("common.table.export")}
          </Button>
          <DataTableViewOptions table={table} />
        </div>
      </div>
      <CollapsibleContent className="overflow-hidden">
        <div className="flex w-full flex-wrap items-center justify-end gap-2 border-t pt-3">
          <Select value={status} onValueChange={(value) => onStatusChange(asStatus(value))}>
            <SelectTrigger size="sm" className="w-32" aria-label={t("timeTracking.filters.status")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="active">{t("timeTracking.status.active")}</SelectItem>
                <SelectItem value="deleted">{t("timeTracking.status.deleted")}</SelectItem>
                <SelectItem value="all">{t("timeTracking.status.all")}</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          {projectColumn && hasProjects ? (
            <DataTableFacetedFilter
              column={projectColumn}
              title={t("timeTracking.fields.project")}
            />
          ) : null}
          {taskColumn && hasTasks ? (
            <DataTableFacetedFilter column={taskColumn} title={t("timeTracking.fields.task")} />
          ) : null}
          {billableColumn ? (
            <DataTableFacetedFilter
              column={billableColumn}
              title={t("timeTracking.fields.billable")}
            />
          ) : null}
          {invoicedColumn ? (
            <DataTableFacetedFilter
              column={invoicedColumn}
              title={t("timeTracking.fields.invoiced")}
            />
          ) : null}
          {startedColumn ? (
            <DataTableDateFilter
              column={startedColumn}
              title={t("timeTracking.fields.startedAt")}
            />
          ) : null}
          {hasActiveFilters ? (
            <Button variant="ghost" size="sm" onClick={onReset}>
              <Icon name="X" aria-hidden="true" />
              {t("timeTracking.filters.reset")}
            </Button>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export { TimeTrackingFilters }
