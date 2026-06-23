"use client"

import { useTranslation } from "@/lib/i18n"

import { formatCompactNumber } from "@/lib/utils"

import { StatCard, StatValue } from "@/components/ui"

import { type ProjectsSummary } from "../../services"

import {
  CompletionRateDonut,
  GrowthAreaChart,
  NewProjectsBarChart,
  StatusBreakdownDonut
} from "./charts"

type ProjectsSummaryBandProps = {
  summary: ProjectsSummary
  locale: string
}

const ProjectsSummaryBand = ({ summary, locale }: ProjectsSummaryBandProps) => {
  const { t } = useTranslation()

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard icon="FolderKanban" label={t("projects.summary.total")}>
        <StatValue
          value={formatCompactNumber(summary.total, locale)}
          title={summary.total.toString()}
          hint={
            summary.newThisMonth > 0
              ? t("projects.summary.newThisMonthDelta", { count: summary.newThisMonth })
              : t("projects.summary.totalHint")
          }
        />
        <GrowthAreaChart
          data={summary.acquisitionTrend}
          locale={locale}
          label={t("projects.summary.trendTotalLabel")}
          emptyLabel={t("projects.summary.trendEmpty")}
        />
      </StatCard>
      <StatCard icon="Play" label={t("projects.summary.active")}>
        <StatValue
          value={formatCompactNumber(summary.active, locale)}
          title={summary.active.toString()}
          hint={t("projects.summary.activeHint")}
        />
        <NewProjectsBarChart
          data={summary.acquisitionTrend}
          locale={locale}
          label={t("projects.summary.trendNewLabel")}
          emptyLabel={t("projects.summary.trendEmpty")}
        />
      </StatCard>
      <StatCard icon="Pause" label={t("projects.summary.onHold")}>
        <StatValue
          value={formatCompactNumber(summary.onHold, locale)}
          title={summary.onHold.toString()}
          hint={t("projects.summary.onHoldHint")}
        />
        <StatusBreakdownDonut summary={summary} />
      </StatCard>
      <StatCard icon="CircleCheck" label={t("projects.summary.completed")}>
        <StatValue
          value={formatCompactNumber(summary.completed, locale)}
          title={summary.completed.toString()}
          hint={t("projects.summary.completedHint")}
        />
        <CompletionRateDonut completed={summary.completed} total={summary.total} />
      </StatCard>
    </div>
  )
}

export { ProjectsSummaryBand }
