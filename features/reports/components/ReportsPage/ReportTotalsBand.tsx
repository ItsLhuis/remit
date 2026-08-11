"use client"

import { useTranslation } from "@/lib/i18n"

import { formatCurrency, formatHours, formatNumber } from "@/lib/utils"

import { StatCard, StatValue } from "@/components/ui"

import { reportColumnLabelKeys, reportHeadlineColumns, reportPresentation } from "../../labels"
import { type ReportKind } from "../../schemas"
import { getCellValue, type ReportCell, type ReportResult } from "../../services"

function formatTotal(cell: ReportCell | undefined, currency: string, locale: string): string {
  if (!cell) return ""
  if (cell.kind === "money") return formatCurrency(cell.cents, currency, locale)
  if (cell.kind === "duration") return formatHours(cell.seconds, locale)

  return formatNumber(getCellValue(cell), locale)
}

type ReportTotalsBandProps = {
  report: ReportKind
  result: ReportResult
  locale: string
}

// One card per currency, which is where the currency rule becomes visible rather than merely true:
// the table below paginates and sorts across every currency at once, so these are the only totals on
// the page, and there is deliberately no combined figure beside them to add up to.
//
// The totals describe the whole report, not the table's current page — the same relationship
// `ExpensesSummaryBand` has with the expense table under it.
const ReportTotalsBand = ({ report, result, locale }: ReportTotalsBandProps) => {
  const { t } = useTranslation()

  const headlineColumn = reportHeadlineColumns[report]
  const headlineIndex = result.columns.indexOf(headlineColumn)

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {result.groups.map((group) => (
        <StatCard
          key={group.currency}
          icon={reportPresentation[report].icon}
          label={group.currency}
        >
          <StatValue
            mono
            value={formatTotal(group.totals[headlineIndex], group.currency, locale)}
            title={t(reportColumnLabelKeys[headlineColumn])}
            hint={t("reports.summary.hint", {
              column: t(reportColumnLabelKeys[headlineColumn]),
              count: group.rows.length
            })}
          />
        </StatCard>
      ))}
    </div>
  )
}

export { ReportTotalsBand }
