import { describe, expect, test } from "vitest"

import {
  calculateCreditNoteLineTotals,
  calculateCreditNoteTotal,
  type CreditNoteLineItemInput
} from "../calculateCreditNoteTotal"

function makeLine(overrides?: Partial<CreditNoteLineItemInput>): CreditNoteLineItemInput {
  return {
    quantity: 1,
    unitPriceCents: 10000,
    discount: null,
    taxPercentage: 0,
    ...overrides
  }
}

describe("calculateCreditNoteTotal", () => {
  test("returns zeroes when there are no line items", () => {
    const totals = calculateCreditNoteTotal([])

    expect(totals).toEqual({ subtotalCents: 0, taxAmountCents: 0, totalCents: 0 })
  })

  test("multiplies quantity by unit price into the subtotal", () => {
    const totals = calculateCreditNoteTotal([makeLine({ quantity: 3, unitPriceCents: 25000 })])

    expect(totals.subtotalCents).toBe(75000)
    expect(totals.totalCents).toBe(75000)
  })

  test("rounds a fractional quantity to whole cents rather than carrying a float", () => {
    const totals = calculateCreditNoteTotal([makeLine({ quantity: 1.5, unitPriceCents: 3333 })])

    expect(totals.subtotalCents).toBe(5000)
  })

  test("returns a zero total when the unit price is zero", () => {
    const totals = calculateCreditNoteTotal([makeLine({ unitPriceCents: 0, taxPercentage: 23 })])

    expect(totals).toEqual({ subtotalCents: 0, taxAmountCents: 0, totalCents: 0 })
  })

  test("reduces the line by a percentage discount before tax is applied", () => {
    const totals = calculateCreditNoteTotal([
      makeLine({ discount: { type: "percentage", percentage: 10 }, taxPercentage: 20 })
    ])

    expect(totals.subtotalCents).toBe(9000)
    expect(totals.taxAmountCents).toBe(1800)
    expect(totals.totalCents).toBe(10800)
  })

  test("rounds a percentage discount that lands between cents", () => {
    const totals = calculateCreditNoteTotal([
      makeLine({ unitPriceCents: 3333, discount: { type: "percentage", percentage: 33.33 } })
    ])

    expect(totals.subtotalCents).toBe(3333 - 1111)
  })

  test("caps a fixed discount at the line gross so the line never inverts", () => {
    const totals = calculateCreditNoteTotal([
      makeLine({ unitPriceCents: 5000, discount: { type: "fixed", amountCents: 9000 } })
    ])

    expect(totals.subtotalCents).toBe(0)
    expect(totals.totalCents).toBe(0)
  })

  test("taxes each line at its own snapshot rate when the rates differ", () => {
    const totals = calculateCreditNoteTotal([
      makeLine({ unitPriceCents: 10000, taxPercentage: 23 }),
      makeLine({ unitPriceCents: 10000, taxPercentage: 6 })
    ])

    expect(totals.subtotalCents).toBe(20000)
    expect(totals.taxAmountCents).toBe(2300 + 600)
    expect(totals.totalCents).toBe(22900)
  })

  test("rounds tax per line rather than once over the summed base", () => {
    const totals = calculateCreditNoteTotal([
      makeLine({ unitPriceCents: 1005, taxPercentage: 5 }),
      makeLine({ unitPriceCents: 1005, taxPercentage: 5 })
    ])

    expect(totals.taxAmountCents).toBe(50 + 50)
  })

  test("keeps the total equal to subtotal plus tax, the identity the stored columns encode", () => {
    const totals = calculateCreditNoteTotal([
      makeLine({ quantity: 2, unitPriceCents: 4999, taxPercentage: 23 }),
      makeLine({ unitPriceCents: 1234, discount: { type: "fixed", amountCents: 200 } })
    ])

    expect(totals.totalCents).toBe(totals.subtotalCents + totals.taxAmountCents)
  })

  test("never produces a negative component, which chk_credit_notes_totals forbids", () => {
    const totals = calculateCreditNoteTotal([
      makeLine({ discount: { type: "percentage", percentage: 100 }, taxPercentage: 23 })
    ])

    expect(totals.subtotalCents).toBeGreaterThanOrEqual(0)
    expect(totals.taxAmountCents).toBeGreaterThanOrEqual(0)
    expect(totals.totalCents).toBeGreaterThanOrEqual(0)
  })
})

describe("calculateCreditNoteLineTotals", () => {
  test("returns one entry per line item in input order", () => {
    const lines = calculateCreditNoteLineTotals([
      makeLine({ unitPriceCents: 100 }),
      makeLine({ unitPriceCents: 200 })
    ])

    expect(lines.map((line) => line.subtotalCents)).toEqual([100, 200])
  })

  test("sums its line totals to the document total", () => {
    const lineItems = [
      makeLine({ quantity: 3, unitPriceCents: 1999, taxPercentage: 23 }),
      makeLine({ unitPriceCents: 5000, discount: { type: "percentage", percentage: 15 } })
    ]

    const lines = calculateCreditNoteLineTotals(lineItems)

    expect(lines.reduce((total, line) => total + line.totalCents, 0)).toBe(
      calculateCreditNoteTotal(lineItems).totalCents
    )
  })

  test("returns an empty list when there are no line items", () => {
    expect(calculateCreditNoteLineTotals([])).toEqual([])
  })
})
