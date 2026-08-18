"use client"

import { useTranslation } from "@/lib/i18n"

import { formatCurrency } from "@/lib/utils"

import { Meter, MeterLegend, MeterLegendItem, Typography } from "@/components/ui"

import { agingBucketPresentation } from "../../labels"
import { type ReceivablesAging } from "../../services"

import { DashboardHint } from "./DashboardHint"

type AgingBarProps = {
  aging: ReceivablesAging
  currency: string
  locale: string
}

// The bar answers "how old is the money" in one glance and the legend answers it exactly. Both are
// rendered from the same four buckets in the same fixed order, so a reader who checks the legend
// against the bar can always match a segment to a row.
const AgingBar = ({ aging, currency, locale }: AgingBarProps) => {
  const { t } = useTranslation()

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex items-center gap-1.5">
        <Typography affects={["muted", "small", "medium"]}>
          {t("dashboard.position.agingTitle")}
        </Typography>
        <DashboardHint label={t("dashboard.position.agingHint")} />
      </div>
      <Meter
        label={t("dashboard.position.meterLabel")}
        segments={aging.buckets.map((bucket) => ({
          id: bucket.id,
          value: bucket.cents,
          className: agingBucketPresentation[bucket.id].swatchClassName
        }))}
      />
      <MeterLegend>
        {aging.buckets.map((bucket) => (
          <MeterLegendItem
            key={bucket.id}
            swatchClassName={agingBucketPresentation[bucket.id].swatchClassName}
            label={t(`dashboard.aging.${bucket.id}`)}
            value={formatCurrency(bucket.cents, currency, locale)}
            detail={t("dashboard.aging.count", { count: bucket.count })}
          />
        ))}
      </MeterLegend>
    </div>
  )
}

export { AgingBar }
