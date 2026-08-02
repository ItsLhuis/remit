import { describe, expect, test } from "vitest"

import {
  calculateInvoiceLineTotals,
  calculateInvoiceTotal,
  type InvoiceLineItemInput
} from "../calculateInvoiceTotal"

function makeLine(overrides?: Partial<InvoiceLineItemInput>): InvoiceLineItemInput {
  return {
    quantity: 1,
    unitPriceCents: 10000,
    discount: null,
    taxPercentage: 0,
    ...overrides
  }
}

describe("calculateInvoiceTotal", () => {
  test("returns zeroes when there are no line items", () => {
    const totals = calculateInvoiceTotal([])

    expect(totals).toEqual({
      subtotalCents: 0,
      discountAmountTotalCents: 0,
      taxAmountCents: 0,
      totalCents: 0
    })
  })

  test("multiplies quantity by unit price into the subtotal", () => {
    const totals = calculateInvoiceTotal([makeLine({ quantity: 3, unitPriceCents: 25000 })])

    expect(totals.subtotalCents).toBe(75000)
    expect(totals.totalCents).toBe(75000)
  })

  test("rounds a fractional quantity to whole cents rather than carrying a float", () => {
    const totals = calculateInvoiceTotal([makeLine({ quantity: 1.5, unitPriceCents: 3333 })])

    expect(totals.subtotalCents).toBe(5000)
    expect(Number.isInteger(totals.totalCents)).toBe(true)
  })

  test("applies a percentage line discount before tax", () => {
    const totals = calculateInvoiceTotal([
      makeLine({
        unitPriceCents: 100000,
        discount: { type: "percentage", percentage: 10 },
        taxPercentage: 20
      })
    ])

    expect(totals.discountAmountTotalCents).toBe(10000)
    expect(totals.taxAmountCents).toBe(18000)
    expect(totals.totalCents).toBe(108000)
  })

  test("never lets a fixed line discount invert the line", () => {
    const totals = calculateInvoiceTotal([
      makeLine({ unitPriceCents: 5000, discount: { type: "fixed", amountCents: 900000 } })
    ])

    expect(totals.discountAmountTotalCents).toBe(5000)
    expect(totals.totalCents).toBe(0)
  })

  test("zeroes the total when a full document discount is applied", () => {
    const totals = calculateInvoiceTotal(
      [makeLine({ unitPriceCents: 100000, taxPercentage: 23 })],
      { type: "percentage", percentage: 100 }
    )

    expect(totals.discountAmountTotalCents).toBe(100000)
    expect(totals.taxAmountCents).toBe(0)
    expect(totals.totalCents).toBe(0)
  })

  test("compounds a document discount onto the post-line-discount net", () => {
    const totals = calculateInvoiceTotal(
      [makeLine({ unitPriceCents: 100000, discount: { type: "percentage", percentage: 50 } })],
      { type: "percentage", percentage: 50 }
    )

    expect(totals.discountAmountTotalCents).toBe(75000)
    expect(totals.totalCents).toBe(25000)
  })

  test("caps a fixed document discount at the net rather than the gross", () => {
    const totals = calculateInvoiceTotal(
      [makeLine({ unitPriceCents: 10000, discount: { type: "fixed", amountCents: 4000 } })],
      { type: "fixed", amountCents: 999999 }
    )

    expect(totals.discountAmountTotalCents).toBe(10000)
    expect(totals.totalCents).toBe(0)
  })

  test("taxes each line at its own rate when the rates differ", () => {
    const totals = calculateInvoiceTotal([
      makeLine({ unitPriceCents: 100000, taxPercentage: 10 }),
      makeLine({ unitPriceCents: 100000, taxPercentage: 23 })
    ])

    expect(totals.taxAmountCents).toBe(33000)
    expect(totals.totalCents).toBe(233000)
  })

  test("spreads a document discount across mixed tax rates before taxing", () => {
    const totals = calculateInvoiceTotal(
      [
        makeLine({ unitPriceCents: 100000, taxPercentage: 10 }),
        makeLine({ unitPriceCents: 100000, taxPercentage: 23 })
      ],
      { type: "percentage", percentage: 50 }
    )

    expect(totals.discountAmountTotalCents).toBe(100000)
    expect(totals.taxAmountCents).toBe(16500)
    expect(totals.totalCents).toBe(116500)
  })

  test("prefers the percentage discount when the kind says percentage", () => {
    const totals = calculateInvoiceTotal([makeLine({ unitPriceCents: 100000 })], {
      type: "percentage",
      percentage: 25
    })

    expect(totals.discountAmountTotalCents).toBe(25000)
  })

  test("prefers the fixed amount when the kind says fixed", () => {
    const totals = calculateInvoiceTotal([makeLine({ unitPriceCents: 100000 })], {
      type: "fixed",
      amountCents: 25000
    })

    expect(totals.discountAmountTotalCents).toBe(25000)
  })
})

describe("calculateInvoiceLineTotals", () => {
  test("returns one entry per line item", () => {
    const lines = calculateInvoiceLineTotals([makeLine(), makeLine(), makeLine()])

    expect(lines).toHaveLength(3)
  })

  test("sums the line totals to exactly the invoice total under a document discount", () => {
    const lineItems = [
      makeLine({ unitPriceCents: 33333, taxPercentage: 10 }),
      makeLine({ unitPriceCents: 33333, taxPercentage: 23 }),
      makeLine({ unitPriceCents: 33334, taxPercentage: 0 })
    ]
    const discount = { type: "percentage", percentage: 33 } as const

    const totals = calculateInvoiceTotal(lineItems, discount)
    const lines = calculateInvoiceLineTotals(lineItems, discount)

    expect(lines.reduce((sum, line) => sum + line.totalCents, 0)).toBe(totals.totalCents)
  })

  test("hands the rounding remainder to the earlier line on a tie", () => {
    const lineItems = [makeLine({ unitPriceCents: 100 }), makeLine({ unitPriceCents: 100 })]

    const lines = calculateInvoiceLineTotals(lineItems, { type: "fixed", amountCents: 1 })

    expect(lines[0]?.totalCents).toBe(99)
    expect(lines[1]?.totalCents).toBe(100)
  })
})
