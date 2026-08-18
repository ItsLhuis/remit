const MILLISECONDS_PER_DAY = 86_400_000
const SCHEDULE_WINDOW_DAYS = 60
const SCHEDULE_LIMIT = 5

export type UpcomingScheduleRow = {
  id: string
  name: string
  clientName: string
  cadence: string
  nextRunAt: Date
}

export type UpcomingSchedule = UpcomingScheduleRow & {
  daysUntilRun: number
}

// A schedule whose run date has already passed is kept and reported with a negative day count: the
// sweep that generates it runs on a cron (ADR-0023), so a date in the past means the run is pending
// rather than missed, and hiding it would hide the one case worth looking at.
export function selectUpcomingSchedules(
  rows: readonly UpcomingScheduleRow[],
  now: Date,
  days = SCHEDULE_WINDOW_DAYS,
  limit = SCHEDULE_LIMIT
): UpcomingSchedule[] {
  const today = toUtcDayValue(now)
  const upcoming: UpcomingSchedule[] = []

  for (const row of rows) {
    const daysUntilRun = Math.round((toUtcDayValue(row.nextRunAt) - today) / MILLISECONDS_PER_DAY)

    if (daysUntilRun > days) continue

    upcoming.push({ ...row, daysUntilRun })
  }

  return upcoming.sort((first, second) => first.daysUntilRun - second.daysUntilRun).slice(0, limit)
}

function toUtcDayValue(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
}
