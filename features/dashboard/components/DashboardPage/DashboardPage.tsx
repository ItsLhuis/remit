"use client"

import { useTranslation } from "@/lib/i18n"

import { Typography } from "@/components/ui"

import { type DashboardPageData } from "../../types"

import { AttentionRail } from "./AttentionRail"
import { CashflowCard } from "./CashflowCard"
import { DetailTabsCard } from "./DetailTabsCard"
import { LifecycleCard } from "./LifecycleCard"
import { MetricRow } from "./MetricRow"
import { PipelineCard } from "./PipelineCard"
import { PositionPanel } from "./PositionPanel"
import { RecentActivityCard } from "./RecentActivityCard"

type DashboardPageProps = {
  data: DashboardPageData
}

// Five tiers, and the tiers are the design. Every grid here carries `items-start` on purpose: a
// card's height must be governed by its own content, and the previous version's `xl:grid-cols-3`
// stretched an empty list to match a full activity feed beside it, which read as a rendering fault
// rather than as a state. Column spans are deliberately uneven (2/1, 3/2, 1/1) so the eye reads a
// hierarchy down the page instead of a wall of equal boxes.
//
// Every grid child is wrapped in `min-w-0`. A grid item defaults to `min-width: auto`, which is the
// intrinsic width of its contents, so a chart or a table inside a column can push that column wider
// than its track and force the whole page sideways. The wrapper is what lets each card's own
// `overflow-x-auto` do its job instead.
const DashboardPage = ({ data }: DashboardPageProps) => {
  const { t } = useTranslation()

  const locale = data.defaults.defaultLocale

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <PositionPanel
        receivables={data.receivables}
        aging={data.aging}
        currency={data.currency}
        locale={locale}
      />
      <MetricRow
        metrics={data.metrics}
        unbilled={data.unbilled}
        currency={data.currency}
        locale={locale}
      />
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <CashflowCard data={data.cashflow} locale={locale} currency={data.currency} />
        </div>
        <div className="min-w-0">
          <AttentionRail
            items={data.attention}
            totalCount={data.attentionTotalCount}
            locale={locale}
          />
        </div>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          <LifecycleCard lifecycle={data.lifecycle} currency={data.currency} locale={locale} />
        </div>
        <div className="min-w-0 lg:col-span-2">
          <PipelineCard pipeline={data.pipeline} locale={locale} />
        </div>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="min-w-0">
          <DetailTabsCard
            invoices={data.upcomingInvoices}
            schedules={data.schedules}
            clients={data.topClients}
            currency={data.currency}
            locale={locale}
          />
        </div>
        <div className="min-w-0">
          <RecentActivityCard
            entries={data.activity}
            locale={locale}
            timeZone={data.defaults.defaultTimezone}
          />
        </div>
      </div>
      {data.otherCurrencyCount > 0 ? (
        <Typography affects={["muted", "small"]}>
          {t("dashboard.currencyNote", {
            currency: data.currency,
            count: data.otherCurrencyCount
          })}
        </Typography>
      ) : null}
    </div>
  )
}

export { DashboardPage }
