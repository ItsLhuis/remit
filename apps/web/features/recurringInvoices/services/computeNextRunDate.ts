import { type RecurringInvoiceCadence } from "../schemas"

export type NextRunDateInput = {
  cadence: RecurringInvoiceCadence
  // Weekly: the ISO weekday the run lands on, 1 = Monday through 7 = Sunday. Monthly and longer: the
  // day of the month, 1-31, clamped to the target month's length. Null means "keep the day the
  // anchor already has", which is what a schedule created without an explicit day gets.
  cadenceDay: number | null
  lastRunAt: Date
}

const MONTHS_PER_CADENCE: Record<Exclude<RecurringInvoiceCadence, "weekly">, number> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12
}

const DAYS_PER_WEEK = 7

// The next occurrence strictly after `lastRunAt`, as a UTC date-only value.
//
// Everything is built through `Date.UTC` rather than the local-time constructors on purpose:
// `recurring_invoices.next_run_at` is a `date` column whose driver value is `toISOString()`, so a
// locally-constructed date stores the previous or following day for any instance away from
// Greenwich. It also makes the function immune to DST — a local-time "add one month" can land on a
// wall clock that does not exist, while UTC has no such hour.
//
// `lastRunAt` is an argument rather than something read here, which is what lets the tests pin an
// exact anchor without faking the clock (architecture.md, pure services).
export function computeNextRunDate({ cadence, cadenceDay, lastRunAt }: NextRunDateInput): Date {
  const anchor = toUtcDay(lastRunAt)

  if (cadence === "weekly") return nextWeeklyRun(anchor, cadenceDay)

  const monthStep = MONTHS_PER_CADENCE[cadence]
  const targetMonth = anchor.getUTCMonth() + monthStep
  const year = anchor.getUTCFullYear()
  const day = cadenceDay ?? anchor.getUTCDate()

  // A schedule anchored on the 31st still has to run in a 30-day month, and `Date.UTC` would roll a
  // day past the end into the next month instead — turning a monthly schedule into one that drifts
  // forward a month at a time. Clamping to the last day of the target month is the behaviour a
  // "bill on the 31st" schedule means, and it does not accumulate: the next run is derived from the
  // stored `cadence_day`, not from the clamped date.
  return new Date(Date.UTC(year, targetMonth, Math.min(day, daysInMonth(year, targetMonth))))
}

function nextWeeklyRun(anchor: Date, cadenceDay: number | null): Date {
  if (cadenceDay === null) return addUtcDays(anchor, DAYS_PER_WEEK)

  // `getUTCDay()` is 0 for Sunday; `cadenceDay` is ISO, where Sunday is 7.
  const anchorIsoDay = anchor.getUTCDay() === 0 ? DAYS_PER_WEEK : anchor.getUTCDay()
  const offset = (cadenceDay - anchorIsoDay + DAYS_PER_WEEK) % DAYS_PER_WEEK

  // Zero would mean "the anchor itself", and the next run must be strictly after it, so an anchor
  // already sitting on the target weekday advances a full week rather than standing still.
  return addUtcDays(anchor, offset === 0 ? DAYS_PER_WEEK : offset)
}

function addUtcDays(value: Date, days: number): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate() + days))
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

export function toUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
}
