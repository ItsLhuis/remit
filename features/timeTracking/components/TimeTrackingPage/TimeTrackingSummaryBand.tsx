"use client"

import { useTranslation } from "@/lib/i18n"

import { formatCurrency } from "@/lib/utils"

import { StatCard, StatValue } from "@/components/ui"

import { toDurationParts } from "../../services"
import { type TimeTrackingSummary } from "../../types"

type TimeTrackingSummaryBandProps = {
  summary: TimeTrackingSummary
  locale: string
}

const TimeTrackingSummaryBand = ({ summary, locale }: TimeTrackingSummaryBandProps) => {
  const { t } = useTranslation()

  const tracked = toDurationParts(summary.totalSeconds)
  const billable = toDurationParts(summary.billableSeconds)
  const unbilled = toDurationParts(summary.unbilledSeconds)

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard icon="Clock" label={t("timeTracking.summary.tracked")}>
        <StatValue
          mono
          value={t("timeTracking.duration.hoursMinutes", tracked)}
          title={t("timeTracking.summary.tracked")}
          hint={t("timeTracking.summary.trackedHint")}
        />
      </StatCard>
      <StatCard icon="CircleDollarSign" label={t("timeTracking.summary.billable")}>
        <StatValue
          mono
          value={t("timeTracking.duration.hoursMinutes", billable)}
          title={t("timeTracking.summary.billable")}
          hint={t("timeTracking.summary.billableHint")}
        />
      </StatCard>
      <StatCard icon="ReceiptText" label={t("timeTracking.summary.unbilled")}>
        <StatValue
          mono
          value={formatCurrency(summary.unbilledAmountCents, summary.unbilledCurrency, locale)}
          title={t("timeTracking.summary.unbilled")}
          hint={t("timeTracking.summary.unbilledHint", {
            duration: t("timeTracking.duration.hoursMinutes", unbilled)
          })}
        />
      </StatCard>
    </div>
  )
}

export { TimeTrackingSummaryBand }
