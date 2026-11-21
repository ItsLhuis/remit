import { describe, expect, test } from "vitest"

import {
  getCurrencyTotal,
  resolvePrimaryCurrency,
  toCurrencyTotals,
  type CurrencyTotal
} from "../currencyTotals"

describe("toCurrencyTotals", () => {
  test("orders currencies by value, largest first", () => {
    const totals = toCurrencyTotals(
      new Map([
        ["EUR", 500],
        ["USD", 9000],
        ["GBP", 1200]
      ])
    )

    expect(totals.map((total) => total.currency)).toEqual(["USD", "GBP", "EUR"])
  })

  test("returns an empty list when there is nothing to total", () => {
    expect(toCurrencyTotals(new Map())).toEqual([])
  })
})

describe("getCurrencyTotal", () => {
  const totals: CurrencyTotal[] = [
    { currency: "EUR", totalCents: 4500 },
    { currency: "USD", totalCents: 900 }
  ]

  test("returns the total recorded for the requested currency", () => {
    expect(getCurrencyTotal(totals, "USD")).toBe(900)
  })

  test("returns zero for a currency with nothing recorded", () => {
    expect(getCurrencyTotal(totals, "GBP")).toBe(0)
  })
})

describe("resolvePrimaryCurrency", () => {
  test("picks the currency carrying the most money across every bucket", () => {
    const primary = resolvePrimaryCurrency(
      [
        [{ currency: "EUR", totalCents: 1000 }],
        [
          { currency: "USD", totalCents: 900 },
          { currency: "EUR", totalCents: 400 }
        ]
      ],
      "GBP"
    )

    expect(primary).toEqual({ currency: "EUR", otherCurrencyCount: 1 })
  })

  test("falls back to the instance default when no money is recorded at all", () => {
    expect(resolvePrimaryCurrency([[], []], "GBP")).toEqual({
      currency: "GBP",
      otherCurrencyCount: 0
    })
  })

  test("reports no other currencies when the instance holds only one", () => {
    const primary = resolvePrimaryCurrency([[{ currency: "EUR", totalCents: 1000 }]], "GBP")

    expect(primary.otherCurrencyCount).toBe(0)
  })
})
