"use client"

import dynamic from "next/dynamic"

import { useTranslation } from "@/lib/i18n"

import { formatCurrency, formatNumber } from "@/lib/utils"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  MeterLegend,
  MeterLegendItem,
  Typography
} from "@/components/ui"

import { lifecycleStagePresentation } from "../../labels"
import { type InvoiceLifecycle } from "../../services"

import { DashboardCardEmpty } from "./DashboardCardEmpty"
import { DashboardHint } from "./DashboardHint"

const LifecycleChart = dynamic(() => import("./charts").then((module) => module.LifecycleChart), {
  ssr: false
})

type LifecycleCardProps = {
  lifecycle: InvoiceLifecycle
  currency: string
  locale: string
}

// The card exists for one sentence: how many issued invoices have never been opened. `view_count` is
// written only by the public `/i/[token]` route, so a zero there means the client genuinely has not
// looked — a different situation from an invoice that was opened and still has not been paid, and
// the only one of the two that resending fixes.
//
// The chart is `aria-hidden` and the legend below it is the accessible equivalent: it carries every
// stage, count and value in real DOM order, with each stage's meaning in a keyboard-reachable
// tooltip. A separate visually hidden table would state the same numbers a third time.
const LifecycleCard = ({ lifecycle, currency, locale }: LifecycleCardProps) => {
  const { t } = useTranslation()

  const hasInvoices = lifecycle.stages.some((stage) => stage.count > 0)

  if (!hasInvoices) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard.lifecycle.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <DashboardCardEmpty
            icon="FileText"
            title={t("dashboard.lifecycle.emptyTitle")}
            description={t("dashboard.lifecycle.emptyDescription")}
            action={{ label: t("dashboard.lifecycle.emptyAction"), href: "/invoices" }}
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          {t("dashboard.lifecycle.title")}
          <DashboardHint label={t("dashboard.periods.fixedWindow")} />
        </CardTitle>
        <CardDescription>{t("dashboard.lifecycle.description", { currency })}</CardDescription>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-4">
        <LifecycleChart
          data={lifecycle.stages.map((stage) => ({
            id: stage.id,
            label: t(`dashboard.lifecycle.stages.${stage.id}`),
            count: stage.count,
            cents: stage.cents,
            color: lifecycleStagePresentation[stage.id].colorVariable
          }))}
          locale={locale}
          currency={currency}
          countLabel={t("dashboard.lifecycle.countColumn")}
        />
        <MeterLegend className="@md/meter-legend:grid-cols-1">
          {lifecycle.stages.map((stage) => (
            <MeterLegendItem
              key={stage.id}
              swatchClassName={lifecycleStagePresentation[stage.id].swatchClassName}
              label={t(`dashboard.lifecycle.stages.${stage.id}`)}
              value={formatNumber(stage.count, locale)}
              detail={formatCurrency(stage.cents, currency, locale)}
            >
              <DashboardHint label={t(`dashboard.lifecycle.hints.${stage.id}`)} />
            </MeterLegendItem>
          ))}
        </MeterLegend>
        <Typography affects={["muted", "small"]}>
          {lifecycle.unviewedCount > 0
            ? t("dashboard.lifecycle.unviewedNote", { count: lifecycle.unviewedCount })
            : t("dashboard.lifecycle.allViewedNote")}
        </Typography>
      </CardContent>
    </Card>
  )
}

export { LifecycleCard }
