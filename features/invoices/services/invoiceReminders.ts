export type ReminderSchedule = {
  beforeDueDays: number[]
  afterDueDays: number[]
}

export type DueReminder = {
  offsetDays: number
  phase: "before" | "after"
}

// Which reminder, if any, an invoice is owed today.
//
// The two settings arrays carry no CHECK constraint of any kind — an empty array, negatives,
// duplicates and unsorted values are all storable — so every one of those is normalised here rather
// than assumed. Negatives are dropped rather than reinterpreted: a negative "days before due" is a
// typo, and guessing it meant "after" would send a client a chasing email early.
//
// `0` in the before-array means the due day itself. The after-array is checked first so an offset
// that appears in both cannot send the friendly reminder when the invoice is already late.
export function resolveDueReminder(
  dueDate: Date,
  schedule: ReminderSchedule,
  now: Date
): DueReminder | null {
  const daysUntilDue = toUtcDayDifference(dueDate, now)

  if (daysUntilDue < 0 && schedule.afterDueDays.some((days) => days === -daysUntilDue)) {
    return { offsetDays: -daysUntilDue, phase: "after" }
  }

  if (daysUntilDue >= 0 && schedule.beforeDueDays.some((days) => days === daysUntilDue)) {
    return { offsetDays: daysUntilDue, phase: "before" }
  }

  return null
}

// The widest window the sweep has to look at, so it can bound its candidate query instead of reading
// every unpaid invoice ever issued. Returns null when the instance has no reminders configured at
// all, which the caller reads as "there is nothing to sweep".
export function getReminderWindowDays(schedule: ReminderSchedule): number | null {
  const offsets = [...schedule.beforeDueDays, ...schedule.afterDueDays].filter((days) => days >= 0)

  return offsets.length === 0 ? null : Math.max(...offsets)
}

const MILLISECONDS_PER_DAY = 86_400_000

// Whole UTC days from `now` to `dueDate`: positive while the invoice is still in time, negative once
// it is late. Both sides are truncated to their UTC day first, so an instance in any zone agrees
// about which day it is — the same normalisation `isInvoiceOverdue` uses.
function toUtcDayDifference(dueDate: Date, now: Date): number {
  return (toUtcDayValue(dueDate) - toUtcDayValue(now)) / MILLISECONDS_PER_DAY
}

function toUtcDayValue(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
}
