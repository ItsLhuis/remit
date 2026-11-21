import { describe, expect, test } from "vitest"

import { aggregateExpensesByCategory, type ExpenseReportRow } from "../aggregateExpensesByCategory"

function makeRow(overrides: Partial<ExpenseReportRow> = {}): ExpenseReportRow {
  return {
    category: "travel",
    currency: "EUR",
    amountCents: 12_000,
    rebillableCents: 0,
    ...overrides
  }
}

describe("aggregateExpensesByCategory", () => {
  test("returns nothing when no expense falls in the window", () => {
    expect(aggregateExpensesByCategory([]).groups).toEqual([])
  })

  test("sums the expenses of one category and counts them", () => {
    const result = aggregateExpensesByCategory([
      makeRow({ amountCents: 12_000, rebillableCents: 13_200 }),
      makeRow({ amountCents: 8_000 })
    ])

    expect(result.groups[0]?.rows[0]?.cells).toEqual([
      { kind: "count", value: 2 },
      { kind: "money", cents: 20_000 },
      { kind: "money", cents: 13_200 }
    ])
  })

  test("keeps one category's two currencies apart", () => {
    const result = aggregateExpensesByCategory([
      makeRow({ currency: "EUR", amountCents: 12_000 }),
      makeRow({ currency: "USD", amountCents: 5_000 })
    ])

    expect(result.groups).toHaveLength(2)
    expect(result.groups.every((group) => group.rows.length === 1)).toBe(true)
  })
})
