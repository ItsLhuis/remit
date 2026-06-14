"use client"

import { useTranslation } from "@/lib/i18n"

import { formatCompactCurrency, formatCompactNumber, formatCurrency } from "@/lib/utils"

import { StatCard, StatValue } from "@/components/ui"

import { type ClientsSummary } from "../../services"

import { GrowthAreaChart, NewClientsBarChart } from "./charts"
import { HealthDonut } from "./HealthDonut"
import { OutstandingBreakdown } from "./OutstandingBreakdown"

type ClientsSummaryBandProps = {
  summary: ClientsSummary
  locale: string
  defaultCurrency: string
}

const ClientsSummaryBand = ({ summary, locale, defaultCurrency }: ClientsSummaryBandProps) => {
  const { t } = useTranslation()

  const topOutstanding = summary.outstandingByCurrency[0]
  const outstandingCents = topOutstanding?.totalCents ?? 0
  const outstandingCurrency = topOutstanding?.currency ?? defaultCurrency

  const outstandingHint = summary.hasSingleCurrency
    ? t("clients.summary.outstandingHint")
    : t("clients.summary.outstandingMultiCurrency", {
        count: summary.outstandingByCurrency.length
      })

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard icon="Users" label={t("clients.summary.activeClients")}>
        <StatValue
          value={formatCompactNumber(summary.totalClients, locale)}
          title={summary.totalClients.toString()}
          hint={
            summary.newClients > 0
              ? t("clients.summary.monthlyDelta", { count: summary.newClients })
              : t("clients.summary.activeClientsHint")
          }
        />
        <GrowthAreaChart
          data={summary.acquisitionTrend}
          locale={locale}
          label={t("clients.summary.trendTotalLabel")}
        />
      </StatCard>
      <StatCard icon="Wallet" label={t("clients.summary.outstanding")}>
        <StatValue
          value={formatCompactCurrency(outstandingCents, outstandingCurrency, locale)}
          title={formatCurrency(outstandingCents, outstandingCurrency, locale)}
          hint={outstandingHint}
          mono
        />
        <OutstandingBreakdown
          items={summary.outstandingByCurrency}
          owingClients={summary.owingClients}
          locale={locale}
        />
      </StatCard>
      <StatCard icon="UserPlus" label={t("clients.summary.newClients")}>
        <StatValue
          value={formatCompactNumber(summary.newClients, locale)}
          title={summary.newClients.toString()}
          hint={t("clients.summary.last6Months")}
        />
        <NewClientsBarChart
          data={summary.acquisitionTrend}
          locale={locale}
          label={t("clients.summary.trendNewLabel")}
        />
      </StatCard>
      <StatCard icon="Activity" label={t("clients.summary.healthTitle")}>
        <HealthDonut
          distribution={summary.healthDistribution}
          total={summary.totalClients}
          locale={locale}
        />
      </StatCard>
    </div>
  )
}

export { ClientsSummaryBand }
