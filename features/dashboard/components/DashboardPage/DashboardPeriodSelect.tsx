"use client"

import { type TransitionStartFunction } from "react"

import { useTranslation } from "@/lib/i18n"

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner
} from "@/components/ui"

import { useDashboardPeriod } from "../../hooks"
import { type DashboardPeriod } from "../../schemas"

function asPeriod(value: string): DashboardPeriod {
  if (value === "month" || value === "quarter" || value === "all") return value

  return "year"
}

type DashboardPeriodSelectProps = {
  isPending: boolean
  startTransition: TransitionStartFunction
}

const DashboardPeriodSelect = ({ isPending, startTransition }: DashboardPeriodSelectProps) => {
  const { t } = useTranslation()

  const [period, setPeriod] = useDashboardPeriod(startTransition)

  return (
    <div className="flex items-center gap-2">
      {isPending ? <Spinner /> : null}
      <Select value={period} onValueChange={(value) => void setPeriod(asPeriod(value))}>
        <SelectTrigger size="sm" className="w-36" aria-label={t("dashboard.periods.label")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="month">{t("dashboard.periods.month")}</SelectItem>
            <SelectItem value="quarter">{t("dashboard.periods.quarter")}</SelectItem>
            <SelectItem value="year">{t("dashboard.periods.year")}</SelectItem>
            <SelectItem value="all">{t("dashboard.periods.all")}</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}

export { DashboardPeriodSelect }
