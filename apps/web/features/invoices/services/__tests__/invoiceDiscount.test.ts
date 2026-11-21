import { describe, expect, test } from "vitest"

import {
  toInvoiceColumnDiscount,
  toInvoiceDiscount,
  toInvoiceDiscountColumns
} from "../invoiceDiscount"

describe("toInvoiceDiscount", () => {
  test("reads a percentage discount from the form", () => {
    const discount = toInvoiceDiscount({
      discountKind: "percentage",
      discountPercentage: 12.5,
      discountAmount: null
    })

    expect(discount).toEqual({ type: "percentage", percentage: 12.5 })
  })

  test("reads a fixed discount from the form in cents", () => {
    const discount = toInvoiceDiscount({
      discountKind: "fixed",
      discountPercentage: null,
      discountAmount: 2500
    })

    expect(discount).toEqual({ type: "fixed", amountCents: 2500 })
  })

  test("reads no discount when the kind is none, whatever the fields still hold", () => {
    const discount = toInvoiceDiscount({
      discountKind: "none",
      discountPercentage: 10,
      discountAmount: 500
    })

    expect(discount).toBeNull()
  })

  test("reads no discount when the chosen kind has no value", () => {
    const percentage = toInvoiceDiscount({
      discountKind: "percentage",
      discountPercentage: null,
      discountAmount: 500
    })
    const fixed = toInvoiceDiscount({
      discountKind: "fixed",
      discountPercentage: 10,
      discountAmount: null
    })

    expect(percentage).toBeNull()
    expect(fixed).toBeNull()
  })
})

describe("toInvoiceDiscountColumns", () => {
  test("stores a percentage as its numeric string with no amount", () => {
    const columns = toInvoiceDiscountColumns({
      discountKind: "percentage",
      discountPercentage: 7.5,
      discountAmount: 900
    })

    expect(columns).toEqual({
      discountType: "percentage",
      discountPercentage: "7.5",
      discountAmountCents: null
    })
  })

  test("stores a fixed amount with no percentage", () => {
    const columns = toInvoiceDiscountColumns({
      discountKind: "fixed",
      discountPercentage: 20,
      discountAmount: 1500
    })

    expect(columns).toEqual({
      discountType: "fixed",
      discountPercentage: null,
      discountAmountCents: 1500
    })
  })

  test("stores all three columns empty when there is no discount", () => {
    const columns = toInvoiceDiscountColumns({
      discountKind: "fixed",
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

describe("toInvoiceColumnDiscount", () => {
  test("reads a stored percentage back as a number", () => {
    const discount = toInvoiceColumnDiscount({
      discountType: "percentage",
      discountPercentage: "12.50",
      discountAmountCents: null
    })

    expect(discount).toEqual({ type: "percentage", percentage: 12.5 })
  })

  test("reads a stored fixed amount back in cents", () => {
    const discount = toInvoiceColumnDiscount({
      discountType: "fixed",
      discountPercentage: null,
      discountAmountCents: 4200
    })

    expect(discount).toEqual({ type: "fixed", amountCents: 4200 })
  })

  test("reads no discount from a row whose type has no matching value", () => {
    const percentage = toInvoiceColumnDiscount({
      discountType: "percentage",
      discountPercentage: null,
      discountAmountCents: 4200
    })
    const fixed = toInvoiceColumnDiscount({
      discountType: "fixed",
      discountPercentage: "10",
      discountAmountCents: null
    })
    const none = toInvoiceColumnDiscount({
      discountType: null,
      discountPercentage: null,
      discountAmountCents: null
    })

    expect(percentage).toBeNull()
    expect(fixed).toBeNull()
    expect(none).toBeNull()
  })

  test("round-trips a submitted discount through its stored columns", () => {
    const submitted = {
      discountKind: "percentage" as const,
      discountPercentage: 15,
      discountAmount: null
    }

    const stored = toInvoiceColumnDiscount(toInvoiceDiscountColumns(submitted))

    expect(stored).toEqual(toInvoiceDiscount(submitted))
  })
})
