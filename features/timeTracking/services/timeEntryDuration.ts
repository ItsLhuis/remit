export const SECONDS_PER_HOUR = 3600

const MILLISECONDS_PER_SECOND = 1000
const SECONDS_PER_MINUTE = 60

export type DurationParts = {
  hours: number
  minutes: number
  seconds: number
}

// Subtracting two instants, never two wall-clock readings, is what makes this correct across a DST
// boundary and across midnight alike: an entry running 00:30 → 02:30 local on a spring-forward night
// is one elapsed hour, and the calendar arithmetic that would call it two never happens here. The
// callers hold `timestamptz` values, so the difference is already the true elapsed time.
//
// Returns null for an end before its start rather than a negative duration, so the caller surfaces a
// field error instead of writing a row that `chk_time_entries_ended` would reject anyway.
export function computeDurationSeconds(startedAt: Date, endedAt: Date): number | null {
  const elapsedMilliseconds = endedAt.getTime() - startedAt.getTime()

  if (!Number.isFinite(elapsedMilliseconds) || elapsedMilliseconds < 0) return null

  return Math.floor(elapsedMilliseconds / MILLISECONDS_PER_SECOND)
}

// The single place a duration becomes money. Every caller — the per-row amount a table cell shows,
// the unbilled totals in `aggregateBillableHours` — goes through here, so the row a freelancer reads
// and the total above it can never disagree about where the half-cent went.
export function calculateEntryAmountCents(
  durationSeconds: number | null,
  hourlyRateCents: number
): number {
  return Math.round(((durationSeconds ?? 0) / SECONDS_PER_HOUR) * hourlyRateCents)
}

export function toDurationParts(totalSeconds: number): DurationParts {
  const safeSeconds = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0

  return {
    hours: Math.floor(safeSeconds / SECONDS_PER_HOUR),
    minutes: Math.floor((safeSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE),
    seconds: safeSeconds % SECONDS_PER_MINUTE
  }
}
