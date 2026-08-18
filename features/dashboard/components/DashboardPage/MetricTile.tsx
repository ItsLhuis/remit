"use client"

import { type ReactNode } from "react"

import dynamic from "next/dynamic"
import Link from "next/link"

import { useTranslation } from "@/lib/i18n"

import { formatCompactCurrency, formatCurrency } from "@/lib/utils"

import { Button, Card, CardContent, Typography } from "@/components/ui"

import { type PeriodDelta } from "../../services"

import { DashboardHint } from "./DashboardHint"
import { MetricDelta } from "./MetricDelta"

const MetricSparkline = dynamic(() => import("./charts").then((module) => module.MetricSparkline), {
  ssr: false
})

type MetricTileAction = {
  label: string
  href: string
}

type MetricTileProps = {
  label: string
  hint: string
  cents: number
  currency: string
  locale: string
  delta?: PeriodDelta
  series?: number[]
  isEmpty: boolean
  emptyHint: string
  action?: MetricTileAction
  children?: ReactNode
}

// A tile is one figure, its movement against the equivalent slice of the previous period, and the
// twelve-month shape behind it. The sparkline is deliberately not period-scoped: it exists to give
// the figure a shape, and a one-month period would leave it with a single point.
//
// The sparkline sizes itself against the tile rather than the viewport (`@container/metric`),
// because the tile is widest on a phone (one up) and narrowest on a wide desktop (four up) — a
// viewport breakpoint would get that exactly backwards. The figure itself never shrinks: it is the
// content, and `break-words` is what keeps an unusually long amount inside the card.
//
// The compact value is what the tile shows and the full amount is its `title`, so a figure that
// rounds to "€12K" still exposes the exact cents on hover; the Tabular Figure rule in DESIGN.md is
// what keeps the digits aligned down the row.
const MetricTile = ({
  label,
  hint,
  cents,
  currency,
  locale,
  delta,
  series,
  isEmpty,
  emptyHint,
  action,
  children
}: MetricTileProps) => {
  const { t } = useTranslation()

  const hasTrend = series?.some((value) => value !== 0) ?? false

  return (
    <Card size="sm" className="min-w-0">
      <CardContent className="@container/metric flex flex-col gap-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <Typography affects={["muted", "small", "medium"]} className="truncate">
            {label}
          </Typography>
          <DashboardHint label={hint} />
        </div>
        <div className="flex min-w-0 items-end justify-between gap-3">
          <span
            className="min-w-0 font-mono text-2xl leading-none font-semibold tracking-tight break-words tabular-nums"
            title={formatCurrency(cents, currency, locale)}
          >
            {formatCompactCurrency(cents, currency, locale)}
          </span>
          {series && hasTrend ? (
            <div className="w-14 shrink-0 @xs/metric:w-20">
              <MetricSparkline series={series} label={t("dashboard.metrics.trendLabel")} />
            </div>
          ) : null}
        </div>
        {isEmpty ? <Typography affects={["muted", "tiny"]}>{emptyHint}</Typography> : null}
        {!isEmpty && delta ? (
          <MetricDelta delta={delta} currency={currency} locale={locale} />
        ) : null}
        {children}
        {isEmpty && action ? (
          <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}

export { MetricTile }
