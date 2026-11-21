import { describe, expect, test } from "vitest"

import { resolveDashboardWindow } from "../dashboardPeriod"
import { summarizeExpenseSpend, type ExpenseSpendRow } from "../summarizeExpenseSpend"

const NOW = new Date("2026-08-10T13:45:12.000Z")

function makeRow(overrides: Partial<ExpenseSpendRow> = {}): ExpenseSpendRow {
  return {
    amountCents: 2500,
    currency: "EUR",
    spentAt: new Date("2026-08-04T00:00:00.000Z"),
    ...overrides
  }
}

describe("summarizeExpenseSpend", () => {
  test("sums the expenses that fall inside the selected window", () => {
    const rows = [makeRow({ amountCents: 2500 }), makeRow({ amountCents: 700 })]

    const summary = summarizeExpenseSpend(rows, resolveDashboardWindow("month", NOW))

    expect(summary).toEqual({ period: [{ currency: "EUR", totalCents: 3200 }], count: 2 })
  })

  test("includes an expense stamped exactly at the window start", () => {
    const rows = [makeRow({ spentAt: new Date("2026-08-01T00:00:00.000Z") })]

    expect(summarizeExpenseSpend(rows, resolveDashboardWindow("month", NOW)).count).toBe(1)
  })

  test("excludes an expense one millisecond before the window start", () => {
    const rows = [makeRow({ spentAt: new Date("2026-07-31T23:59:59.999Z") })]

    expect(summarizeExpenseSpend(rows, resolveDashboardWindow("month", NOW))).toEqual({
      period: [],
      count: 0
    })
  })

  test("keeps each currency in its own bucket", () => {
    const rows = [
      makeRow({ amountCents: 1000, currency: "EUR" }),
      makeRow({ amountCents: 4000, currency: "USD" })
    ]

    const summary = summarizeExpenseSpend(rows, resolveDashboardWindow("year", NOW))

    expect(summary.period).toEqual([
      { currency: "USD", totalCents: 4000 },
      { currency: "EUR", totalCents: 1000 }
    ])
  })

  test("counts every expense when the window is all time", () => {
    const rows = [makeRow({ spentAt: new Date("2019-03-01T00:00:00.000Z") }), makeRow()]

    expect(summarizeExpenseSpend(rows, resolveDashboardWindow("all", NOW)).count).toBe(2)
  })
})
