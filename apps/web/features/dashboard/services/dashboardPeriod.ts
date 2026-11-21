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

// A bounded slice, unlike `DashboardWindow`, because a comparison period has already ended and
// therefore has a top as well as a bottom. `null` means the period has no comparable predecessor.
export type DashboardRange = {
  start: Date
  endExclusive: Date
}

// The same elapsed slice of the previous period, not the whole of it. Nine days into a month, the
// honest comparison is the first nine days of the month before; comparing against a complete
// previous month would report a fall every time a period begins, which is arithmetic, not news.
// The all-time period has no predecessor to compare against and returns null rather than inventing
// one, and the surface renders no delta at all when it does.
export function resolveComparisonRange(period: DashboardPeriod, now: Date): DashboardRange | null {
  const currentStart = resolveDashboardWindow(period, now).start

  if (!currentStart) return null

  const elapsedMilliseconds = now.getTime() - currentStart.getTime()
  const start = shiftBackOnePeriod(period, currentStart)

  return { start, endExclusive: new Date(start.getTime() + elapsedMilliseconds) }
}

export function isWithinRange(value: Date, range: DashboardRange): boolean {
  const time = value.getTime()

  return time >= range.start.getTime() && time < range.endExclusive.getTime()
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

// Steps the calendar unit rather than subtracting a fixed number of days, so a 28-day February and
// a 92-day quarter each land on their own predecessor's first instant.
function shiftBackOnePeriod(period: DashboardPeriod, start: Date): Date {
  const year = start.getUTCFullYear()
  const month = start.getUTCMonth()

  if (period === "month") return new Date(Date.UTC(year, month - 1, 1))
  if (period === "quarter") return new Date(Date.UTC(year, month - 3, 1))

  return new Date(Date.UTC(year - 1, 0, 1))
}
