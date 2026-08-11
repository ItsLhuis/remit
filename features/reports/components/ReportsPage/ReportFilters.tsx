"use client"

import { useTranslation } from "@/lib/i18n"

import {
  Badge,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  DataTableViewOptions,
  DatePicker,
  Field,
  FieldLabel,
  Icon,
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

import { reportPresentation } from "../../labels"
import { REPORT_FILTERS, REPORT_KINDS, type ReportFilterId, type ReportKind } from "../../schemas"
import { type ReportTableRow } from "../../services"
import { type ReportFilterOptions } from "../../types"

import { ReportEntityFilter } from "./ReportEntityFilter"

function asReportKind(value: string): ReportKind {
  const match = REPORT_KINDS.find((kind) => kind === value)

  return match ?? "revenueByClient"
}

function countActiveFilters(from: string, to: string, entityIds: Record<string, string>): number {
  const dates = (from === "" ? 0 : 1) + (to === "" ? 0 : 1)

  return dates + Object.values(entityIds).filter((value) => value !== "").length
}

type ReportFiltersProps = {
  table: Table<ReportTableRow>
  report: ReportKind
  rowCount: number
  from: string
  to: string
  entityIds: Record<ReportFilterId, string>
  filterOptions: ReportFilterOptions
  isExporting: boolean
  onReportChange: (value: ReportKind) => void
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
  onEntityChange: (filter: ReportFilterId, value: string) => void
  onExport: () => void
  onReset: () => void
}

const ReportFilters = ({
  table,
  report,
  rowCount,
  from,
  to,
  entityIds,
  filterOptions,
  isExporting,
  onReportChange,
  onFromChange,
  onToChange,
  onEntityChange,
  onExport,
  onReset
}: ReportFiltersProps) => {
  const { t } = useTranslation()

  const activeFilterCount = countActiveFilters(from, to, entityIds)

  const entityOptions: Record<ReportFilterId, ReportFilterOptions["clients"]> = {
    client: filterOptions.clients,
    project: filterOptions.projects,
    taxRate: filterOptions.taxRates
  }

  return (
    <Collapsible defaultOpen={activeFilterCount > 0} className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <Field className="w-full sm:w-64">
          <FieldLabel htmlFor="report-kind">{t("reports.filters.report")}</FieldLabel>
          <Select value={report} onValueChange={(value) => onReportChange(asReportKind(value))}>
            <SelectTrigger id="report-kind" size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {REPORT_KINDS.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {t(reportPresentation[kind].titleKey)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Typography affects={["muted", "tiny"]}>
            {t("reports.table.rowCount", { count: rowCount })}
          </Typography>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm">
              <Icon name="ListFilter" aria-hidden="true" />
              {t("reports.filters.title")}
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
            disabled={isExporting || rowCount === 0}
            onClick={onExport}
          >
            {isExporting ? <Spinner /> : <Icon name="Download" aria-hidden="true" />}
            {t("reports.actions.export")}
          </Button>
          <DataTableViewOptions table={table} />
        </div>
      </div>
      <CollapsibleContent className="overflow-hidden">
        <div className="flex w-full flex-wrap items-end justify-end gap-3 border-t pt-3">
          <Field className="w-full sm:w-44">
            <FieldLabel htmlFor="report-from">{t("reports.filters.from")}</FieldLabel>
            <DatePicker id="report-from" value={from} onChangeAction={onFromChange} />
          </Field>
          <Field className="w-full sm:w-44">
            <FieldLabel htmlFor="report-to">{t("reports.filters.to")}</FieldLabel>
            <DatePicker id="report-to" value={to} onChangeAction={onToChange} />
          </Field>
          {REPORT_FILTERS[report].map((filter) => (
            <ReportEntityFilter
              key={filter}
              filter={filter}
              value={entityIds[filter]}
              options={entityOptions[filter]}
              onChange={onEntityChange}
            />
          ))}
          {activeFilterCount > 0 ? (
            <Button variant="ghost" size="sm" onClick={onReset}>
              <Icon name="X" aria-hidden="true" />
              {t("reports.filters.reset")}
            </Button>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export { ReportFilters }
