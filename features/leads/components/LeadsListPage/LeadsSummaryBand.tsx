"use client"

import { useTranslation } from "@/lib/i18n"

import { formatCompactNumber } from "@/lib/utils"

import { StatCard, StatValue } from "@/components/ui"

import { type LeadsSummary } from "../../services"

import { ConversionDonut, GrowthAreaChart, NewLeadsBarChart, WonRateDonut } from "./charts"

type LeadsSummaryBandProps = {
  summary: LeadsSummary
  locale: string
}

const LeadsSummaryBand = ({ summary, locale }: LeadsSummaryBandProps) => {
  const { t } = useTranslation()

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard icon="Target" label={t("leads.summary.total")}>
        <StatValue
          value={formatCompactNumber(summary.total, locale)}
          title={summary.total.toString()}
          hint={
            summary.newThisMonth > 0
              ? t("leads.summary.newThisMonthDelta", { count: summary.newThisMonth })
              : t("leads.summary.totalHint")
          }
        />
        <GrowthAreaChart
          data={summary.acquisitionTrend}
          locale={locale}
          label={t("leads.summary.trendTotalLabel")}
        />
      </StatCard>
      <StatCard icon="Workflow" label={t("leads.summary.open")}>
        <StatValue
          value={formatCompactNumber(summary.open, locale)}
          title={summary.open.toString()}
          hint={t("leads.summary.openHint")}
        />
        <NewLeadsBarChart
          data={summary.acquisitionTrend}
          locale={locale}
          label={t("leads.summary.trendNewLabel")}
        />
      </StatCard>
      <StatCard icon="Trophy" label={t("leads.summary.won")}>
        <StatValue
          value={formatCompactNumber(summary.won, locale)}
          title={summary.won.toString()}
          hint={t("leads.summary.wonHint")}
        />
        <WonRateDonut won={summary.won} lost={summary.lost} />
      </StatCard>
      <StatCard icon="UserPlus" label={t("leads.summary.converted")}>
        <StatValue
          value={formatCompactNumber(summary.converted, locale)}
          title={summary.converted.toString()}
          hint={t("leads.summary.convertedHint")}
        />
        <ConversionDonut converted={summary.converted} total={summary.total} />
      </StatCard>
    </div>
  )
}

export { LeadsSummaryBand }
