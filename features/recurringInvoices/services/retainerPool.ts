export type RetainerTerms = {
  includedHours: number
  overageRateCents: number
}

export type RetainerUsage = {
  includedHours: number
  consumedHours: number
  remainingHours: number
  overageHours: number
  overageCents: number
  exhausted: boolean
}

const SECONDS_PER_HOUR = 3600

// A retainer is a pool of hours sold up front. Hours worked inside the pool are already paid for and
// add nothing to the invoice; hours beyond it bill at `overage_rate_cents`.
//
// Rounding happens exactly once, at the end, on the money: hours stay fractional through the
// subtraction so a pool consumed in quarter-hours does not accumulate a rounding error per entry,
// and only the resulting amount is forced back to integer cents (ADR-0009, money-and-dates.md).
//
// `exhausted` is deliberately `>=` rather than `>`: a pool consumed to exactly zero has none left,
// and the freelancer wants to hear that before the next hour is worked rather than after.
export function calculateRetainerUsage(terms: RetainerTerms, consumedHours: number): RetainerUsage {
  const consumed = Math.max(consumedHours, 0)
  const overageHours = Math.max(consumed - terms.includedHours, 0)

  return {
    includedHours: terms.includedHours,
    consumedHours: consumed,
    remainingHours: Math.max(terms.includedHours - consumed, 0),
    overageHours,
    overageCents: Math.round(overageHours * terms.overageRateCents),
    exhausted: consumed >= terms.includedHours
  }
}

// Both retainer columns are independently nullable in the schema, and
// `chk_recurring_invoices_retainer` only requires that they are either both null or both
// non-negative — it cannot express "both or neither". Narrowing here is what keeps every caller from
// having to decide what a half-configured retainer means.
export function toRetainerTerms(schedule: {
  includedHours: number | null
  overageRateCents: number | null
}): RetainerTerms | null {
  if (schedule.includedHours === null || schedule.overageRateCents === null) return null

  return { includedHours: schedule.includedHours, overageRateCents: schedule.overageRateCents }
}

// Time entries store whole seconds; hours are only ever derived, never stored, so that the division
// happens in one place and no two callers disagree about the precision.
export function toConsumedHours(durationSeconds: number): number {
  return Math.max(durationSeconds, 0) / SECONDS_PER_HOUR
}
