import { describe, expect, test } from "vitest"

import { summarizeExpenses, type ExpenseAggregateRow } from "../summarizeExpenses"

function row(overrides: Partial<ExpenseAggregateRow> = {}): ExpenseAggregateRow {
  return {
    amountCents: 10_000,
    currency: "EUR",
    rebillable: true,
    markupPercentage: null,
    invoicedInId: null,
    ...overrides
  }
}

describe("summarizeExpenses", () => {
  test("returns empty totals when there are no expenses", () => {
    const result = summarizeExpenses([])

    expect(result.count).toBe(0)
    expect(result.totalCentsByCurrency).toEqual({})
  })

  test("totals every expense regardless of whether it is rebillable", () => {
    const result = summarizeExpenses([row(), row({ rebillable: false, amountCents: 2500 })])

    expect(result.totalCentsByCurrency.EUR).toBe(12_500)
  })

  test("counts only rebillable expenses towards the rebillable total, with markup applied", () => {
    const result = summarizeExpenses([
      row({ markupPercentage: 20 }),
      row({ rebillable: false, amountCents: 5000 })
    ])

    expect(result.rebillableCentsByCurrency.EUR).toBe(12_000)
  })

  test("excludes an already invoiced expense from the unbilled total", () => {
    const result = summarizeExpenses([
      row({ invoicedInId: "00000000-0000-4000-8000-000000000001" }),
      row({ amountCents: 4000 })
    ])

    expect(result.rebillableCentsByCurrency.EUR).toBe(14_000)
    expect(result.unbilledRebillableCentsByCurrency.EUR).toBe(4000)
  })

  test("keeps currencies apart rather than summing across them", () => {
    const result = summarizeExpenses([row(), row({ currency: "USD", amountCents: 7000 })])

    expect(result.totalCentsByCurrency).toEqual({ EUR: 10_000, USD: 7000 })
  })
})
