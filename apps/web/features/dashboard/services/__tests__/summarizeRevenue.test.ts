import { describe, expect, test } from "vitest"

import { resolveDashboardWindow } from "../dashboardPeriod"
import { summarizeRevenue, type RevenuePaymentRow } from "../summarizeRevenue"

const NOW = new Date("2026-08-10T13:45:12.000Z")

function makeRow(overrides: Partial<RevenuePaymentRow> = {}): RevenuePaymentRow {
  return {
    amountCents: 10_000,
    currency: "EUR",
    paidAt: new Date("2026-08-05T09:00:00.000Z"),
    ...overrides
  }
}

describe("summarizeRevenue", () => {
  test("sums payments banked in the current month into month to date", () => {
    const rows = [makeRow({ amountCents: 2500 }), makeRow({ amountCents: 700 })]

    const summary = summarizeRevenue(rows, NOW, resolveDashboardWindow("year", NOW))

    expect(summary.monthToDate).toEqual([{ currency: "EUR", totalCents: 3200 }])
  })

  test("includes a payment stamped exactly at the first instant of the month", () => {
    const rows = [makeRow({ paidAt: new Date("2026-08-01T00:00:00.000Z") })]

    const summary = summarizeRevenue(rows, NOW, resolveDashboardWindow("year", NOW))

    expect(summary.monthToDate[0]?.totalCents).toBe(10_000)
  })

  test("excludes a payment one millisecond before the month begins", () => {
    const rows = [makeRow({ paidAt: new Date("2026-07-31T23:59:59.999Z") })]

    const summary = summarizeRevenue(rows, NOW, resolveDashboardWindow("year", NOW))

    expect(summary.monthToDate).toEqual([])
    expect(summary.yearToDate).toEqual([{ currency: "EUR", totalCents: 10_000 }])
  })

  test("excludes a payment from the previous year from year to date", () => {
    const rows = [makeRow({ paidAt: new Date("2025-12-31T23:59:59.999Z") })]

    const summary = summarizeRevenue(rows, NOW, resolveDashboardWindow("all", NOW))

    expect(summary.yearToDate).toEqual([])
    expect(summary.period).toEqual([{ currency: "EUR", totalCents: 10_000 }])
  })

  test("keeps each currency in its own bucket instead of summing across them", () => {
    const rows = [
      makeRow({ amountCents: 1000, currency: "EUR" }),
      makeRow({ amountCents: 4000, currency: "USD" })
    ]

    const summary = summarizeRevenue(rows, NOW, resolveDashboardWindow("year", NOW))

    expect(summary.yearToDate).toEqual([
      { currency: "USD", totalCents: 4000 },
      { currency: "EUR", totalCents: 1000 }
    ])
  })

  test("narrows the period bucket to the selected window", () => {
    const rows = [
      makeRow({ amountCents: 1000, paidAt: new Date("2026-08-05T09:00:00.000Z") }),
      makeRow({ amountCents: 2000, paidAt: new Date("2026-05-05T09:00:00.000Z") })
    ]

    const summary = summarizeRevenue(rows, NOW, resolveDashboardWindow("month", NOW))

    expect(summary.period).toEqual([{ currency: "EUR", totalCents: 1000 }])
    expect(summary.yearToDate).toEqual([{ currency: "EUR", totalCents: 3000 }])
  })

  test("returns empty buckets when there are no payments", () => {
    const summary = summarizeRevenue([], NOW, resolveDashboardWindow("year", NOW))

    expect(summary).toEqual({ monthToDate: [], yearToDate: [], period: [] })
  })
})
