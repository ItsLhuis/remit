import { describe, expect, test } from "vitest"

import { aggregateBillableHours, type TimeEntryAggregateRow } from "../aggregateBillableHours"

function makeRow(overrides?: Partial<TimeEntryAggregateRow>): TimeEntryAggregateRow {
  return {
    durationSeconds: 3600,
    billable: true,
    invoicedInId: null,
    hourlyRateSnapshotCents: 10_000,
    currency: "EUR",
    ...overrides
  }
}

describe("aggregateBillableHours", () => {
  test("reports every total as zero when there are no entries", () => {
    const result = aggregateBillableHours([])

    expect(result).toEqual({
      totalSeconds: 0,
      billableSeconds: 0,
      unbilledSeconds: 0,
      unbilledAmountCentsByCurrency: {}
    })
  })

  test("counts a non-billable entry in the total but not in the billable total", () => {
    const result = aggregateBillableHours([makeRow(), makeRow({ billable: false })])

    expect(result.totalSeconds).toBe(7200)
    expect(result.billableSeconds).toBe(3600)
    expect(result.unbilledAmountCentsByCurrency).toEqual({ EUR: 10_000 })
  })

  test("excludes an already invoiced entry from the unbilled totals", () => {
    const result = aggregateBillableHours([
      makeRow(),
      makeRow({ invoicedInId: "5d9f6e2c-0b4a-4a1f-8f9d-2b7c6a1e4d33" })
    ])

    expect(result.billableSeconds).toBe(7200)
    expect(result.unbilledSeconds).toBe(3600)
    expect(result.unbilledAmountCentsByCurrency).toEqual({ EUR: 10_000 })
  })

  test("treats a still-running entry as contributing no duration", () => {
    const result = aggregateBillableHours([makeRow({ durationSeconds: null })])

    expect(result.totalSeconds).toBe(0)
    expect(result.unbilledAmountCentsByCurrency).toEqual({ EUR: 0 })
  })

  test("keeps amounts in separate buckets per currency", () => {
    const result = aggregateBillableHours([
      makeRow({ currency: "EUR", hourlyRateSnapshotCents: 8000 }),
      makeRow({ currency: "USD", hourlyRateSnapshotCents: 9000 })
    ])

    expect(result.unbilledAmountCentsByCurrency).toEqual({ EUR: 8000, USD: 9000 })
  })

  // One second at 50.00/hour is 1.388 cents, which rounds to 1 per entry and 2 across the pair.
  // Rounding the combined 2.777 cents instead would give 3, so this pins the per-entry granularity
  // an invoice line bills at rather than merely re-asserting that some rounding happens.
  test("rounds each entry to whole cents before summing them", () => {
    const result = aggregateBillableHours([
      makeRow({ durationSeconds: 1, hourlyRateSnapshotCents: 5000 }),
      makeRow({ durationSeconds: 1, hourlyRateSnapshotCents: 5000 })
    ])

    expect(result.unbilledAmountCentsByCurrency).toEqual({ EUR: 2 })
  })

  test("prices a partial hour proportionally to the snapshotted rate", () => {
    const result = aggregateBillableHours([
      makeRow({ durationSeconds: 5400, hourlyRateSnapshotCents: 12_000 })
    ])

    expect(result.unbilledAmountCentsByCurrency).toEqual({ EUR: 18_000 })
  })
})
