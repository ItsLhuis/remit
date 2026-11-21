import { isWithinRange, type DashboardRange } from "./dashboardPeriod"

export type RangedAmountRow = {
  occurredAt: Date
  amountCents: number
  currency: string
}

export type DeltaDirection = "up" | "down" | "flat" | "unknown"

export type PeriodDelta = {
  currentCents: number
  previousCents: number | null
  // `null` whenever a percentage would be a lie: no comparable period, or a previous total of zero,
  // against which every increase is an infinite rise. The direction still carries the reading in
  // that case, so the surface can say "up from nothing" without printing a number.
  changePercentage: number | null
  direction: DeltaDirection
}

export function sumRangeCents(
  rows: readonly RangedAmountRow[],
  range: DashboardRange | null,
  currency: string
): number | null {
  if (!range) return null

  let total = 0

  for (const row of rows) {
    if (row.currency !== currency || !isWithinRange(row.occurredAt, range)) continue

    total += row.amountCents
  }

  return total
}

export function summarizeDelta(currentCents: number, previousCents: number | null): PeriodDelta {
  if (previousCents === null) {
    return { currentCents, previousCents: null, changePercentage: null, direction: "unknown" }
  }

  if (previousCents === 0) {
    return {
      currentCents,
      previousCents,
      changePercentage: null,
      direction: currentCents > 0 ? "up" : "flat"
    }
  }

  const change = ((currentCents - previousCents) / previousCents) * 100

  return {
    currentCents,
    previousCents,
    // A tenth of a percent, matching `summarizeTopClients`, so two renders of the same data cannot
    // disagree in the last digit.
    changePercentage: Math.round(change * 10) / 10,
    direction:
      currentCents === previousCents ? "flat" : currentCents > previousCents ? "up" : "down"
  }
}
