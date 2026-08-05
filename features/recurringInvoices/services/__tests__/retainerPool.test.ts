import { describe, expect, test } from "vitest"

import { calculateRetainerUsage, toConsumedHours, toRetainerTerms } from "../retainerPool"

const terms = { includedHours: 10, overageRateCents: 8500 }

describe("within the pool", () => {
  test("bills nothing and reports the remaining hours", () => {
    const usage = calculateRetainerUsage(terms, 6)

    expect(usage.remainingHours).toBe(4)
    expect(usage.overageHours).toBe(0)
    expect(usage.overageCents).toBe(0)
    expect(usage.exhausted).toBe(false)
  })

  test("reports a full pool when nothing has been consumed", () => {
    const usage = calculateRetainerUsage(terms, 0)

    expect(usage.remainingHours).toBe(10)
    expect(usage.exhausted).toBe(false)
  })

  test("clamps a negative consumption to zero", () => {
    const usage = calculateRetainerUsage(terms, -3)

    expect(usage.consumedHours).toBe(0)
    expect(usage.remainingHours).toBe(10)
  })
})

describe("exhaustion", () => {
  test("reports exhaustion when the pool is consumed exactly", () => {
    const usage = calculateRetainerUsage(terms, 10)

    expect(usage.exhausted).toBe(true)
    expect(usage.remainingHours).toBe(0)
    expect(usage.overageCents).toBe(0)
  })

  test("reports exhaustion once consumption passes the pool", () => {
    const usage = calculateRetainerUsage(terms, 10.25)

    expect(usage.exhausted).toBe(true)
  })

  test("reports a zero-hour pool as exhausted immediately", () => {
    const usage = calculateRetainerUsage({ includedHours: 0, overageRateCents: 5000 }, 0)

    expect(usage.exhausted).toBe(true)
  })
})

describe("overage", () => {
  test("bills only the hours beyond the pool", () => {
    const usage = calculateRetainerUsage(terms, 12.5)

    expect(usage.overageHours).toBe(2.5)
    expect(usage.overageCents).toBe(21_250)
    expect(usage.remainingHours).toBe(0)
  })

  test("rounds the amount to whole cents rather than the hours", () => {
    const usage = calculateRetainerUsage({ includedHours: 0, overageRateCents: 10_000 }, 1 / 3)

    expect(usage.overageCents).toBe(3333)
  })

  // Rounding once at the end is the point: rounding each quarter-hour to cents first and summing
  // would drift, and this asserts the whole-pool figure rather than a per-entry one.
  test("does not accumulate rounding error across fractional hours", () => {
    const usage = calculateRetainerUsage({ includedHours: 0, overageRateCents: 3333 }, 0.25 * 7)

    expect(usage.overageCents).toBe(5833)
  })

  test("bills nothing when the overage rate is zero", () => {
    const usage = calculateRetainerUsage({ includedHours: 2, overageRateCents: 0 }, 9)

    expect(usage.overageHours).toBe(7)
    expect(usage.overageCents).toBe(0)
  })
})

describe("toRetainerTerms", () => {
  test("returns terms when both retainer columns are set", () => {
    expect(toRetainerTerms({ includedHours: 10, overageRateCents: 8500 })).toEqual(terms)
  })

  test("returns null when the schedule is not a retainer", () => {
    expect(toRetainerTerms({ includedHours: null, overageRateCents: null })).toBeNull()
  })

  test.each([
    { includedHours: 10, overageRateCents: null },
    { includedHours: null, overageRateCents: 8500 }
  ])("returns null for the half-configured pair %j", (schedule) => {
    expect(toRetainerTerms(schedule)).toBeNull()
  })
})

describe("toConsumedHours", () => {
  test("converts whole seconds to fractional hours", () => {
    expect(toConsumedHours(5400)).toBe(1.5)
  })

  test("clamps a negative duration to zero", () => {
    expect(toConsumedHours(-60)).toBe(0)
  })
})
