import { expect, test } from "vitest"

import { calculateRebillableCents } from "../expenseRebilling"

test("returns nothing for an expense the freelancer absorbs", () => {
  const result = calculateRebillableCents({
    amountCents: 12_000,
    rebillable: false,
    markupPercentage: 50
  })

  expect(result).toBe(0)
})

test("rebills at cost when no markup is set", () => {
  const result = calculateRebillableCents({
    amountCents: 12_000,
    rebillable: true,
    markupPercentage: null
  })

  expect(result).toBe(12_000)
})

test("applies a whole-percent markup", () => {
  const result = calculateRebillableCents({
    amountCents: 10_000,
    rebillable: true,
    markupPercentage: 15
  })

  expect(result).toBe(11_500)
})

test("rounds a fractional cent to the nearest whole cent", () => {
  const result = calculateRebillableCents({
    amountCents: 1000,
    rebillable: true,
    markupPercentage: 33.33
  })

  expect(result).toBe(1333)
})

test("leaves the amount unchanged at a zero markup", () => {
  const result = calculateRebillableCents({
    amountCents: 8250,
    rebillable: true,
    markupPercentage: 0
  })

  expect(result).toBe(8250)
})

test("applies the maximum markup the schema allows", () => {
  const result = calculateRebillableCents({
    amountCents: 1000,
    rebillable: true,
    markupPercentage: 1000
  })

  expect(result).toBe(11_000)
})

test("returns a whole number of cents for every markup it accepts", () => {
  const results = [7.5, 12.34, 99.99, 0.01].map((markupPercentage) =>
    calculateRebillableCents({ amountCents: 3333, rebillable: true, markupPercentage })
  )

  expect(results.every(Number.isInteger)).toBe(true)
})
