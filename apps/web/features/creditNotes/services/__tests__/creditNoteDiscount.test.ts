import { describe, expect, test } from "vitest"

import { toCreditNoteDiscount, toCreditNoteDiscountColumns } from "../creditNoteDiscount"

describe("toCreditNoteDiscount", () => {
  test("reads a percentage line discount from the form", () => {
    const discount = toCreditNoteDiscount({
      discountKind: "percentage",
      discountPercentage: 25,
      discountAmount: null
    })

    expect(discount).toEqual({ type: "percentage", percentage: 25 })
  })

  test("reads a fixed line discount from the form in cents", () => {
    const discount = toCreditNoteDiscount({
      discountKind: "fixed",
      discountPercentage: null,
      discountAmount: 1000
    })

    expect(discount).toEqual({ type: "fixed", amountCents: 1000 })
  })

  test("reads no discount when the kind is none or the chosen kind has no value", () => {
    const none = toCreditNoteDiscount({
      discountKind: "none",
      discountPercentage: 25,
      discountAmount: 1000
    })
    const percentageWithoutValue = toCreditNoteDiscount({
      discountKind: "percentage",
      discountPercentage: null,
      discountAmount: 1000
    })
    const fixedWithoutValue = toCreditNoteDiscount({
      discountKind: "fixed",
      discountPercentage: 25,
      discountAmount: null
    })

    expect(none).toBeNull()
    expect(percentageWithoutValue).toBeNull()
    expect(fixedWithoutValue).toBeNull()
  })
})

describe("toCreditNoteDiscountColumns", () => {
  test("stores a percentage as its numeric string with no amount", () => {
    const columns = toCreditNoteDiscountColumns({
      discountKind: "percentage",
      discountPercentage: 33.3,
      discountAmount: 700
    })

    expect(columns).toEqual({
      discountType: "percentage",
      discountPercentage: "33.3",
      discountAmountCents: null
    })
  })

  test("stores a fixed amount with no percentage", () => {
    const columns = toCreditNoteDiscountColumns({
      discountKind: "fixed",
      discountPercentage: 10,
      discountAmount: 700
    })

    expect(columns).toEqual({
      discountType: "fixed",
      discountPercentage: null,
      discountAmountCents: 700
    })
  })

  test("stores all three columns empty when there is no discount", () => {
    const columns = toCreditNoteDiscountColumns({
      discountKind: "none",
      discountPercentage: null,
      discountAmount: null
    })

    expect(columns).toEqual({
      discountType: null,
      discountPercentage: null,
      discountAmountCents: null
    })
  })
})
