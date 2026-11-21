import { describe, expect, test } from "vitest"

import {
  calculateProposalLineTotals,
  calculateProposalTotal,
  type ProposalLineItemInput
} from "../calculateProposalTotal"

function makeLine(overrides?: Partial<ProposalLineItemInput>): ProposalLineItemInput {
  return {
    quantity: 1,
    unitPriceCents: 10000,
    discount: null,
    taxPercentage: 0,
    ...overrides
  }
}

describe("calculateProposalTotal", () => {
  test("returns zeroes when no line items are provided", () => {
    const result = calculateProposalTotal([])

    expect(result).toEqual({
      subtotalCents: 0,
      discountAmountTotalCents: 0,
      taxAmountCents: 0,
      totalCents: 0
    })
  })

  test("multiplies quantity by unit price when there is no discount or tax", () => {
    const result = calculateProposalTotal([makeLine({ quantity: 3, unitPriceCents: 12500 })])

    expect(result).toEqual({
      subtotalCents: 37500,
      discountAmountTotalCents: 0,
      taxAmountCents: 0,
      totalCents: 37500
    })
  })

  test("rounds a fractional quantity to the nearest cent", () => {
    const result = calculateProposalTotal([makeLine({ quantity: 2.5, unitPriceCents: 3333 })])

    expect(result.subtotalCents).toBe(8333)
  })

  test("applies a line percentage discount before tax", () => {
    const result = calculateProposalTotal([
      makeLine({
        unitPriceCents: 10000,
        discount: { type: "percentage", percentage: 10 },
        taxPercentage: 23
      })
    ])

    expect(result).toEqual({
      subtotalCents: 10000,
      discountAmountTotalCents: 1000,
      taxAmountCents: 2070,
      totalCents: 11070
    })
  })

  test("clamps a fixed line discount to the line gross", () => {
    const result = calculateProposalTotal([
      makeLine({ unitPriceCents: 5000, discount: { type: "fixed", amountCents: 9000 } })
    ])

    expect(result).toEqual({
      subtotalCents: 5000,
      discountAmountTotalCents: 5000,
      taxAmountCents: 0,
      totalCents: 0
    })
  })

  test("zeroes tax and total when a 100 percent document discount is applied", () => {
    const result = calculateProposalTotal(
      [makeLine({ unitPriceCents: 20000, taxPercentage: 23 })],
      { type: "percentage", percentage: 100 }
    )

    expect(result).toEqual({
      subtotalCents: 20000,
      discountAmountTotalCents: 20000,
      taxAmountCents: 0,
      totalCents: 0
    })
  })

  test("clamps a fixed document discount to the post-line-discount net", () => {
    const result = calculateProposalTotal(
      [makeLine({ unitPriceCents: 10000, discount: { type: "percentage", percentage: 50 } })],
      { type: "fixed", amountCents: 999999 }
    )

    expect(result).toEqual({
      subtotalCents: 10000,
      discountAmountTotalCents: 10000,
      taxAmountCents: 0,
      totalCents: 0
    })
  })

  test("compounds a document discount onto the net rather than the gross", () => {
    const result = calculateProposalTotal(
      [makeLine({ unitPriceCents: 10000, discount: { type: "percentage", percentage: 10 } })],
      { type: "percentage", percentage: 10 }
    )

    expect(result.discountAmountTotalCents).toBe(1900)
    expect(result.totalCents).toBe(8100)
  })

  test("taxes each rate on its share of the document discount when rates are mixed", () => {
    const result = calculateProposalTotal(
      [
        makeLine({ unitPriceCents: 10000, taxPercentage: 23 }),
        makeLine({ unitPriceCents: 10000, taxPercentage: 6 })
      ],
      { type: "percentage", percentage: 50 }
    )

    expect(result).toEqual({
      subtotalCents: 20000,
      discountAmountTotalCents: 10000,
      taxAmountCents: 1450,
      totalCents: 11450
    })
  })

  test("distributes an indivisible document discount so the parts sum to the whole", () => {
    const lines = [
      makeLine({ unitPriceCents: 1000, taxPercentage: 10 }),
      makeLine({ unitPriceCents: 1000, taxPercentage: 10 }),
      makeLine({ unitPriceCents: 1000, taxPercentage: 10 })
    ]

    const result = calculateProposalTotal(lines, { type: "fixed", amountCents: 100 })
    const lineTotals = calculateProposalLineTotals(lines, { type: "fixed", amountCents: 100 })

    expect(result.discountAmountTotalCents).toBe(100)
    expect(lineTotals.reduce((total, line) => total + line.totalCents, 0)).toBe(result.totalCents)
  })

  test("ignores tax entirely when every line is untaxed", () => {
    const result = calculateProposalTotal([
      makeLine({ unitPriceCents: 4999 }),
      makeLine({ unitPriceCents: 1 })
    ])

    expect(result.taxAmountCents).toBe(0)
    expect(result.totalCents).toBe(5000)
  })
})

describe("calculateProposalLineTotals", () => {
  test("returns one entry per line item", () => {
    expect(calculateProposalLineTotals([makeLine(), makeLine()])).toHaveLength(2)
  })

  test("sums to the proposal total when no document discount is present", () => {
    const lines = [
      makeLine({ quantity: 2, unitPriceCents: 7350, taxPercentage: 23 }),
      makeLine({ unitPriceCents: 4000, taxPercentage: 6 })
    ]

    const lineTotals = calculateProposalLineTotals(lines)

    expect(lineTotals.reduce((total, line) => total + line.totalCents, 0)).toBe(
      calculateProposalTotal(lines).totalCents
    )
  })

  test("records the line subtotal net of its own discount", () => {
    const lineTotals = calculateProposalLineTotals([
      makeLine({ unitPriceCents: 10000, discount: { type: "fixed", amountCents: 2500 } })
    ])

    expect(lineTotals[0]?.subtotalCents).toBe(7500)
  })
})
