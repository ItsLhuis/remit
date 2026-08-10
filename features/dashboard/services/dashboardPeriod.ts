import { type DashboardPeriod } from "../schemas"

export type DashboardWindow = {
  // `null` means "since the instance began". The all-time period genuinely has no lower bound, and
  // expressing that as a sentinel date would silently drop every row older than whatever date was
  // picked.
  start: Date | null
}

// Windows are computed in UTC, matching how timestamps are stored, so an instance in any zone
// agrees about which month a payment fell in. The display time zone belongs to formatting only
// (money-and-dates.md).
export function resolveDashboardWindow(period: DashboardPeriod, now: Date): DashboardWindow {
  if (period === "month") return { start: startOfUtcMonth(now) }
  if (period === "quarter") return { start: startOfUtcQuarter(now) }
  if (period === "year") return { start: startOfUtcYear(now) }

  return { start: null }
}

export function startOfUtcMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

export function startOfUtcYear(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), 0, 1))
}

// Half-open on purpose: a row stamped exactly at the window start belongs to the new period, not
// the one that just ended, so a payment banked at midnight on the first is this month's revenue.
export function isWithinWindow(value: Date, window: DashboardWindow): boolean {
  if (!window.start) return true

  return value.getTime() >= window.start.getTime()
}

// The earliest instant any dashboard read needs. The page asks one question of each table and
// derives month-to-date, year-to-date and the selected period from the same rows, so the read has
// to reach back as far as the widest of them.
export function resolveEarliestWindowStart(windows: readonly DashboardWindow[]): Date | null {
  let earliest: Date | null = null

  for (const window of windows) {
    if (!window.start) return null
    if (!earliest || window.start.getTime() < earliest.getTime()) earliest = window.start
  }

  return earliest
}

function startOfUtcQuarter(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3, 1))
}
