"use client"

import { useTranslation } from "@/lib/i18n"

import { formatHours } from "@/lib/utils"

import { Typography } from "@/components/ui"

import { type UnbilledWork } from "../../services"
import { type DashboardMetrics } from "../../types"

import { MetricTile } from "./MetricTile"

type MetricRowProps = {
  metrics: DashboardMetrics
  unbilled: UnbilledWork
  currency: string
  locale: string
}

// Four tiles rather than five, because the row now reads as one band at every breakpoint: one up on
// a phone, two on a tablet, four on a desktop, never an orphan. One up below 640px rather than two:
// a money figure, a delta badge and a comparison sentence do not fit in half a phone width without
// wrapping into three ragged lines. "Ready to invoice" replaced the old profit tile at
// the fourth slot — profit moved into "Net estimate" beside the two figures it is derived from, and
// unbilled work is the only tier-two figure that names something the reader can act on today.
const MetricRow = ({ metrics, unbilled, currency, locale }: MetricRowProps) => {
  const { t } = useTranslation()

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricTile
        label={t("dashboard.metrics.revenue")}
        hint={t("dashboard.metrics.revenueHint")}
        cents={metrics.revenue.delta.currentCents}
        currency={currency}
        locale={locale}
        delta={metrics.revenue.delta}
        series={metrics.revenue.series}
        isEmpty={metrics.revenue.delta.currentCents === 0}
        emptyHint={t("dashboard.metrics.emptyHint")}
      />
      <MetricTile
        label={t("dashboard.metrics.expenses")}
        hint={t("dashboard.metrics.expensesHint")}
        cents={metrics.expenses.delta.currentCents}
        currency={currency}
        locale={locale}
        delta={metrics.expenses.delta}
        series={metrics.expenses.series}
        isEmpty={metrics.expenses.delta.currentCents === 0}
        emptyHint={t("dashboard.metrics.emptyHint")}
      />
      <MetricTile
        label={t("dashboard.metrics.net")}
        hint={t("dashboard.metrics.netHint")}
        cents={metrics.net.delta.currentCents}
        currency={currency}
        locale={locale}
        delta={metrics.net.delta}
        series={metrics.net.series}
        isEmpty={
          metrics.revenue.delta.currentCents === 0 && metrics.expenses.delta.currentCents === 0
        }
        emptyHint={t("dashboard.metrics.emptyHint")}
      />
      <MetricTile
        label={t("dashboard.metrics.unbilled")}
        hint={t("dashboard.metrics.unbilledHint")}
        cents={unbilled.totalCents}
        currency={currency}
        locale={locale}
        isEmpty={unbilled.totalCents === 0}
        emptyHint={t("dashboard.metrics.unbilledEmptyHint")}
        action={{ label: t("dashboard.metrics.unbilledAction"), href: "/time" }}
      >
        {unbilled.totalCents > 0 ? (
          <Typography affects={["muted", "tiny"]}>
            {t("dashboard.metrics.unbilledSplit", {
              hours: formatHours(unbilled.timeSeconds, locale),
              count: unbilled.expenseCount
            })}
          </Typography>
        ) : null}
      </MetricTile>
    </div>
  )
}

export { MetricRow }
