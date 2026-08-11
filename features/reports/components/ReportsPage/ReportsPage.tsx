"use client"

import { useMemo, useTransition } from "react"

import { useTranslation } from "@/lib/i18n"

import { downloadCsv } from "@/lib/utils"

import { DataTable, Icon, ScrollArea, SidebarTrigger, Typography, toast } from "@/components/ui"

import { useDataTable } from "@/hooks"

import { useReportFilters } from "../../hooks"
import { reportHeadlineColumns, reportPresentation } from "../../labels"
import { exportReportCsv } from "../../mutations"
import { toReportTableRows } from "../../services"
import { type ReportsPageData } from "../../types"

import { getReportColumns } from "./columns"
import { ReportFilters } from "./ReportFilters"
import { ReportsEmpty } from "./ReportsEmpty"
import { ReportTotalsBand } from "./ReportTotalsBand"

type ReportsPageProps = {
  data: ReportsPageData
}

const ReportsPage = ({ data }: ReportsPageProps) => {
  const { t } = useTranslation()

  const [isPending, startTransition] = useTransition()

  const filters = useReportFilters(startTransition)

  const [isExporting, startExporting] = useTransition()

  const locale = data.defaults.defaultLocale
  const presentation = reportPresentation[data.query.report]

  const rows = useMemo(() => toReportTableRows(data.result), [data.result])

  const columns = useMemo(
    () => getReportColumns({ t, report: data.query.report, columns: data.result.columns, locale }),
    [t, data.query.report, data.result.columns, locale]
  )

  // Client-side by omitting `rowCount`: the server already reduced every invoice, entry and expense
  // to one row per dimension, so the whole report is in memory and paging it here costs a render
  // rather than a round trip. What paging buys is the DOM — a thousand-row report renders one page.
  //
  // Currency leads the sort so a mixed-currency report still reads grouped, and because ordering a
  // money column across currencies orders unlike units.
  const { table } = useDataTable({
    data: rows,
    columns,
    getRowId: (row) => `${row.currency}:${row.key}`,
    enableRowSelection: false,
    columnVisibilityStorageKey: "reports:column-visibility",
    initialState: {
      sorting: [
        { id: "currency", desc: false },
        { id: reportHeadlineColumns[data.query.report], desc: true }
      ]
    }
  })

  // `data.query` is what the server built this page from, so handing the action the same query is
  // what makes the export the complete report rather than the page the table happens to show.
  const onExport = () => {
    if (isExporting) return

    startExporting(async () => {
      const result = await exportReportCsv(data.query)

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      downloadCsv(result.data.csv, result.data.filename)

      toast.success(t("reports.export.exported", { count: result.data.rowCount }))
    })
  }

  return (
    <ScrollArea className="size-full">
      <div className="flex w-full flex-col gap-6 p-4 md:p-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="md:hidden" />
              <Icon
                name={presentation.icon}
                className="text-muted-foreground size-6 shrink-0"
                aria-hidden="true"
              />
              <Typography variant="h2">{t(presentation.titleKey)}</Typography>
            </div>
            <Typography variant="p" affects={["muted", "removePMargin"]}>
              {t(presentation.descriptionKey)}
            </Typography>
          </div>
        </header>
        <ReportTotalsBand report={data.query.report} result={data.result} locale={locale} />
        <DataTable
          table={table}
          caption={t(presentation.titleKey)}
          isLoading={isPending}
          empty={
            <ReportsEmpty hasActiveFilters={filters.hasActiveFilters} onReset={filters.reset} />
          }
        >
          <ReportFilters
            table={table}
            report={filters.report}
            rowCount={rows.length}
            from={filters.from}
            to={filters.to}
            entityIds={filters.entityIds}
            filterOptions={data.filterOptions}
            isExporting={isExporting}
            onReportChange={filters.setReport}
            onFromChange={filters.setFrom}
            onToChange={filters.setTo}
            onEntityChange={filters.setEntityId}
            onExport={onExport}
            onReset={filters.reset}
          />
        </DataTable>
      </div>
    </ScrollArea>
  )
}

export { ReportsPage }
