import { type ApiDateRange } from "@/features/api"

const DAY_MS = 24 * 60 * 60 * 1000

// What the column a range filters on holds. A `date` column compares a whole day as its midnight, so
// an inclusive end is that midnight; a `timestamptz` column holds instants, so an inclusive end is
// the last millisecond of the day — otherwise "up to 31 March" would drop everything logged on the
// 31st after midnight UTC.
export type DayRangeColumn = "date" | "instant"

// Turns the calendar days an assistant names into the bounds the list filters compare with, in UTC.
// The days arrive already validated as `YYYY-MM-DD`, so `Date.parse` reads them as UTC midnight.
export function toDayRange(
  from: string | undefined,
  to: string | undefined,
  column: DayRangeColumn
): ApiDateRange | undefined {
  if (!from && !to) return undefined

  return {
    from: from ? new Date(Date.parse(from)) : null,
    to: to ? toInclusiveEnd(Date.parse(to), column) : null
  }
}

// A yes-or-no argument in the tool's vocabulary becomes the one-value filter in the screen's.
// Absent means no filter, which is not the same as `false`.
export function toFlagFilter<TWhenTrue extends string, TWhenFalse extends string>(
  value: boolean | undefined,
  whenTrue: TWhenTrue,
  whenFalse: TWhenFalse
): readonly (TWhenTrue | TWhenFalse)[] | undefined {
  if (value === undefined) return undefined

  return value ? [whenTrue] : [whenFalse]
}

export function toIdFilter(id: string | undefined): readonly string[] | undefined {
  return id ? [id] : undefined
}

function toInclusiveEnd(dayStartMs: number, column: DayRangeColumn): Date {
  return new Date(column === "date" ? dayStartMs : dayStartMs + DAY_MS - 1)
}
