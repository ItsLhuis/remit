import { describe, expect, test } from "vitest"

import { sumRangeCents, summarizeDelta, type RangedAmountRow } from "../summarizeDelta"

const RANGE = {
  start: new Date("2026-07-01T00:00:00.000Z"),
  endExclusive: new Date("2026-07-10T12:00:00.000Z")
}

function makeRow(overrides: Partial<RangedAmountRow> = {}): RangedAmountRow {
  return {
    occurredAt: new Date("2026-07-05T00:00:00.000Z"),
    amountCents: 10_000,
    currency: "EUR",
    ...overrides
  }
}

describe("sumRangeCents", () => {
  test("returns null when the period has no comparable predecessor", () => {
    expect(sumRangeCents([makeRow()], null, "EUR")).toBeNull()
  })

  test("includes a row stamped exactly at the range start", () => {
    const rows = [makeRow({ occurredAt: new Date("2026-07-01T00:00:00.000Z") })]

    expect(sumRangeCents(rows, RANGE, "EUR")).toBe(10_000)
  })

  test("excludes a row stamped exactly at the range end", () => {
    const rows = [makeRow({ occurredAt: new Date("2026-07-10T12:00:00.000Z") })]

    expect(sumRangeCents(rows, RANGE, "EUR")).toBe(0)
  })

  test("ignores rows recorded in another currency", () => {
    const rows = [makeRow(), makeRow({ currency: "USD", amountCents: 99_000 })]

    expect(sumRangeCents(rows, RANGE, "EUR")).toBe(10_000)
  })
})

describe("summarizeDelta", () => {
  test("reports an unknown direction when there is nothing to compare against", () => {
    const delta = summarizeDelta(50_000, null)

    expect(delta.direction).toBe("unknown")
    expect(delta.changePercentage).toBeNull()
  })

  test("reports a rise with no percentage when the previous period banked nothing", () => {
    const delta = summarizeDelta(50_000, 0)

    expect(delta.direction).toBe("up")
    expect(delta.changePercentage).toBeNull()
  })

  test("reports flat when both periods are zero", () => {
    expect(summarizeDelta(0, 0).direction).toBe("flat")
  })

  test("rounds the change to a tenth of a percent", () => {
    const delta = summarizeDelta(133_333, 100_000)

    expect(delta.changePercentage).toBe(33.3)
    expect(delta.direction).toBe("up")
  })

  test("reports a fall as a negative percentage", () => {
    const delta = summarizeDelta(75_000, 100_000)

    expect(delta.changePercentage).toBe(-25)
    expect(delta.direction).toBe("down")
  })

  test("reports flat when the two periods are identical", () => {
    expect(summarizeDelta(100_000, 100_000).direction).toBe("flat")
  })
})
