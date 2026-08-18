import { describe, expect, test } from "vitest"

import { buildCashflowSeries, toCashflowNetSeries } from "../buildCashflowSeries"

const NOW = new Date("2026-08-10T13:45:12.000Z")

describe("buildCashflowSeries", () => {
  test("returns twelve months ending with the current one", () => {
    const series = buildCashflowSeries({ revenue: [], expenses: [] }, NOW)

    expect(series).toHaveLength(12)
    expect(series[0]?.month).toBe("2025-09")
    expect(series[11]?.month).toBe("2026-08")
  })

  test("zero-fills a month with no activity", () => {
    const series = buildCashflowSeries({ revenue: [], expenses: [] }, NOW)

    expect(series[5]).toEqual({ month: "2026-02", revenueCents: 0, expenseCents: 0 })
  })

  test("buckets revenue and expenses into the month they occurred in", () => {
    const series = buildCashflowSeries(
      {
        revenue: [{ occurredAt: new Date("2026-07-15T00:00:00.000Z"), amountCents: 30_000 }],
        expenses: [{ occurredAt: new Date("2026-07-02T00:00:00.000Z"), amountCents: 4000 }]
      },
      NOW
    )

    expect(series[10]).toEqual({ month: "2026-07", revenueCents: 30_000, expenseCents: 4000 })
  })

  test("assigns a row stamped at the first instant of a month to that month", () => {
    const series = buildCashflowSeries(
      {
        revenue: [{ occurredAt: new Date("2026-08-01T00:00:00.000Z"), amountCents: 100 }],
        expenses: []
      },
      NOW
    )

    expect(series[11]?.revenueCents).toBe(100)
  })

  test("assigns a row one millisecond before a month to the month before it", () => {
    const series = buildCashflowSeries(
      {
        revenue: [{ occurredAt: new Date("2026-07-31T23:59:59.999Z"), amountCents: 100 }],
        expenses: []
      },
      NOW
    )

    expect(series[10]?.revenueCents).toBe(100)
    expect(series[11]?.revenueCents).toBe(0)
  })

  test("ignores a row older than the twelve-month window", () => {
    const series = buildCashflowSeries(
      {
        revenue: [{ occurredAt: new Date("2025-08-31T23:59:59.999Z"), amountCents: 100 }],
        expenses: []
      },
      NOW
    )

    expect(series.every((point) => point.revenueCents === 0)).toBe(true)
  })

  test("crosses the year boundary when stepping backwards from January", () => {
    const series = buildCashflowSeries(
      { revenue: [], expenses: [] },
      new Date("2026-01-15T00:00:00.000Z")
    )

    expect(series[0]?.month).toBe("2025-02")
    expect(series[11]?.month).toBe("2026-01")
  })
})

describe("toCashflowNetSeries", () => {
  test("subtracts each month's expenses from its revenue", () => {
    const points = [
      { month: "2026-07", revenueCents: 100_000, expenseCents: 30_000 },
      { month: "2026-08", revenueCents: 20_000, expenseCents: 50_000 }
    ]

    expect(toCashflowNetSeries(points)).toEqual([70_000, -30_000])
  })

  test("returns an empty series for an empty set of months", () => {
    expect(toCashflowNetSeries([])).toEqual([])
  })
})
