"use client"

import { type ComponentProps } from "react"

import { type TFunction } from "@/lib/i18n"
import { useTranslation } from "@/lib/i18n"

import { formatCurrency } from "@/lib/utils"

import { Badge, Icon, Typography } from "@/components/ui"

import { type DeltaDirection, type PeriodDelta } from "../../services"

const DIRECTION_ICON: Record<DeltaDirection, ComponentProps<typeof Icon>["name"]> = {
  up: "TrendingUp",
  down: "TrendingDown",
  flat: "Minus",
  unknown: "Minus"
}

// Direction is coloured, never judged: `up` is the success tint on every tile including "Spent",
// because this component cannot know whether more spend is good news, and inverting the colour per
// tile would bury an opinion where the reader cannot see it. The text beside the arrow carries the
// reading.
const DIRECTION_VARIANT: Record<DeltaDirection, ComponentProps<typeof Badge>["variant"]> = {
  up: "success",
  down: "destructive",
  flat: "secondary",
  unknown: "secondary"
}

function toChangeLabel(delta: PeriodDelta, t: TFunction): string {
  if (delta.changePercentage === null) {
    return delta.direction === "up"
      ? t("dashboard.metrics.upFromNothing")
      : t("dashboard.metrics.flat")
  }

  if (delta.direction === "up") {
    return t("dashboard.metrics.up", { value: Math.abs(delta.changePercentage) })
  }

  if (delta.direction === "down") {
    return t("dashboard.metrics.down", { value: Math.abs(delta.changePercentage) })
  }

  return t("dashboard.metrics.flat")
}

type MetricDeltaProps = {
  delta: PeriodDelta
  currency: string
  locale: string
}

const MetricDelta = ({ delta, currency, locale }: MetricDeltaProps) => {
  const { t } = useTranslation()

  if (delta.previousCents === null) {
    return (
      <Typography affects={["muted", "tiny"]}>{t("dashboard.metrics.comparisonNone")}</Typography>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <Badge variant={DIRECTION_VARIANT[delta.direction]}>
        <Icon name={DIRECTION_ICON[delta.direction]} aria-hidden="true" />
        {toChangeLabel(delta, t)}
      </Badge>
      <Typography affects={["muted", "tiny"]}>
        {t("dashboard.metrics.comparison", {
          amount: formatCurrency(delta.previousCents, currency, locale)
        })}
      </Typography>
    </div>
  )
}

export { MetricDelta }
