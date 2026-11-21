"use client"

import { useTranslation } from "@/lib/i18n"

import { cn } from "@/lib/utils"

import { toDurationParts } from "../services"

type DurationProps = {
  seconds: number | null
  withSeconds?: boolean
  className?: string
}

const Duration = ({ seconds, withSeconds, className }: DurationProps) => {
  const { t } = useTranslation()

  const parts = toDurationParts(seconds ?? 0)

  return (
    <span className={cn("font-mono tabular-nums", className)}>
      {withSeconds
        ? t("timeTracking.duration.withSeconds", parts)
        : t("timeTracking.duration.hoursMinutes", parts)}
    </span>
  )
}

export { Duration }
