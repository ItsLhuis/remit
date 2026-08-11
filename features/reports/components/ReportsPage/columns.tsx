"use client"

import { type TFunction } from "@/lib/i18n"

import { formatCurrency, formatHours, formatNumber } from "@/lib/utils"

import { DataTableColumnHeader, Skeleton } from "@/components/ui"

import { type ColumnDef } from "@/hooks"

import { reportColumnLabelKeys, reportDimensionLabelKeys } from "../../labels"
import { type ReportKind } from "../../schemas"
import {
  getCellValue,
  type ReportCell,
  type ReportColumnId,
  type ReportTableRow
} from "../../services"

function formatCell(cell: ReportCell | undefined, currency: string, locale: string): string {
  if (!cell) return ""
  if (cell.kind === "money") return formatCurrency(cell.cents, currency, locale)
  if (cell.kind === "duration") return formatHours(cell.seconds, locale)

  return formatNumber(cell.value, locale)
}

type MetricColumnOptions = {
  t: TFunction
  columnId: ReportColumnId
  index: number
  locale: string
}

function toMetricColumn({
  t,
  columnId,
  index,
  locale
}: MetricColumnOptions): ColumnDef<ReportTableRow> {
  return {
    id: columnId,
    accessorFn: (row) => {
      const cell = row.cells[index]

      return cell ? getCellValue(cell) : 0
    },
    meta: {
      label: t(reportColumnLabelKeys[columnId]),
      align: "end",
      headerClassName: "text-right",
      cellClassName: "text-right tabular-nums",
      skeleton: <Skeleton className="ml-auto h-3.5 w-20" />
    },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t(reportColumnLabelKeys[columnId])} />
    ),
    cell: ({ row }) => formatCell(row.original.cells[index], row.original.currency, locale)
  }
}

type ReportColumnsOptions = {
  t: TFunction
  report: ReportKind
  columns: ReportColumnId[]
  locale: string
}

// Cells are positional: every aggregate service in ../../services emits them in the same order as
// the `columns` it declares beside them, so the column's index into `row.cells` is the whole
// contract between the two.
//
// A money cell is formatted in its own row's currency rather than in one page-wide currency, which
// is what lets a mixed-currency report share a single table without ever implying the figures are
// comparable. Sorting a money column across currencies orders unlike units, so `currency` is the
// leading sort in ReportsPage and stays visible as its own column.
export function getReportColumns({
  t,
  report,
  columns,
  locale
}: ReportColumnsOptions): ColumnDef<ReportTableRow>[] {
  return [
    {
      id: "dimension",
      accessorFn: (row) => row.label,
      enableHiding: false,
      meta: {
        label: t(reportDimensionLabelKeys[report]),
        skeleton: (
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        )
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t(reportDimensionLabelKeys[report])} />
      ),
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{row.original.label}</span>
          {row.original.sublabel ? (
            <span className="text-muted-foreground truncate text-xs">{row.original.sublabel}</span>
          ) : null}
        </div>
      )
    },
    {
      id: "currency",
      accessorFn: (row) => row.currency,
      meta: {
        label: t("reports.table.currency"),
        headerClassName: "w-24",
        skeleton: <Skeleton className="h-3.5 w-10" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("reports.table.currency")} />
      ),
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.currency}</span>
    },
    ...columns.map((columnId, index) => toMetricColumn({ t, columnId, index, locale }))
  ]
}
