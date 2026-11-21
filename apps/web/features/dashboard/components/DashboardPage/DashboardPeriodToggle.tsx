"use client"

import { type TransitionStartFunction } from "react"

import { useTranslation } from "@/lib/i18n"

import { Spinner, ToggleGroup, ToggleGroupItem } from "@/components/ui"

import { useDashboardPeriod } from "../../hooks"
import { DASHBOARD_PERIODS, type DashboardPeriod } from "../../schemas"

function asPeriod(value: string): DashboardPeriod | null {
  return DASHBOARD_PERIODS.find((period) => period === value) ?? null
}

type DashboardPeriodToggleProps = {
  isPending: boolean
  startTransition: TransitionStartFunction
}

// A segmented control rather than a select: four mutually exclusive options that fit on one line are
// faster to switch between when every option is visible, and the current period stays legible while
// the next one is being chosen. A deselect (Radix returns `""`) is ignored — the page always has a
// period, so there is no empty state for this control to enter.
//
// The control never scrolls. `ToggleGroupItem` ships `shrink-0`, which is what forces a scrollbar
// when the group is squeezed, so each item overrides it with `min-w-0 shrink`: the group holds its
// natural width while there is room and compresses its labels only once `max-w-full` bites. The
// header above it wraps the whole control onto its own line before that point is reached.
const DashboardPeriodToggle = ({ isPending, startTransition }: DashboardPeriodToggleProps) => {
  const { t } = useTranslation()

  const [period, setPeriod] = useDashboardPeriod(startTransition)

  return (
    <div className="ml-auto flex max-w-full min-w-0 items-center gap-2">
      <Spinner
        aria-hidden={!isPending}
        className={isPending ? "opacity-100" : "pointer-events-none opacity-0"}
      />
      <ToggleGroup
        type="single"
        size="sm"
        variant="outline"
        value={period}
        aria-label={t("dashboard.periods.label")}
        className="max-w-full min-w-0"
        onValueChange={(value) => {
          const next = asPeriod(value)

          if (next) void setPeriod(next)
        }}
      >
        <ToggleGroupItem value="month" className="min-w-0 shrink truncate">
          {t("dashboard.periods.month")}
        </ToggleGroupItem>
        <ToggleGroupItem value="quarter" className="min-w-0 shrink truncate">
          {t("dashboard.periods.quarter")}
        </ToggleGroupItem>
        <ToggleGroupItem value="year" className="min-w-0 shrink truncate">
          {t("dashboard.periods.year")}
        </ToggleGroupItem>
        <ToggleGroupItem value="all" className="min-w-0 shrink truncate">
          {t("dashboard.periods.all")}
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  )
}

export { DashboardPeriodToggle }
