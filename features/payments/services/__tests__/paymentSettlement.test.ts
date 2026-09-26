import { describe, expect, test } from "vitest"

import { getInvoiceOutstandingCents } from "@/features/invoices/services"

import { evaluateInvoiceSettlement, sumPaymentAmountCents } from "../paymentSettlement"

test("reports an invoice with no payments as unpaid", () => {
  const result = evaluateInvoiceSettlement({
    amountPaidCents: 0,
    totalCents: 10000,
    creditedCents: 0
  })

  expect(result).toEqual({ outcome: "unpaid" })
})

test("reports a partial payment when some but not all of the total has arrived", () => {
  const result = evaluateInvoiceSettlement({
    amountPaidCents: 4000,
    totalCents: 10000,
    creditedCents: 0
  })

  expect(result).toEqual({ outcome: "partial" })
})

test("reports settled when the payments reach the total exactly", () => {
  const result = evaluateInvoiceSettlement({
    amountPaidCents: 10000,
    totalCents: 10000,
    creditedCents: 0
  })

  expect(result).toEqual({ outcome: "settled" })
})

test("reports the excess when the payments exceed the total", () => {
  const result = evaluateInvoiceSettlement({
    amountPaidCents: 10001,
    totalCents: 10000,
    creditedCents: 0
  })

  expect(result).toEqual({ outcome: "overpaid", excessCents: 1 })
})

test("treats one cent below the total as partial rather than settled", () => {
  const result = evaluateInvoiceSettlement({
    amountPaidCents: 9999,
    totalCents: 10000,
    creditedCents: 0
  })

  expect(result).toEqual({ outcome: "partial" })
})

test("does not call a zero-total invoice settled", () => {
  const result = evaluateInvoiceSettlement({ amountPaidCents: 0, totalCents: 0, creditedCents: 0 })

  expect(result).toEqual({ outcome: "unpaid" })
})

describe("with credit notes against the invoice", () => {
  test("settles once payments and credit notes together cover the total", () => {
    const result = evaluateInvoiceSettlement({
      amountPaidCents: 7000,
      totalCents: 10000,
      creditedCents: 3000
    })

    expect(result).toEqual({ outcome: "settled" })
  })

  test("settles an invoice credited in full with nothing paid", () => {
    const result = evaluateInvoiceSettlement({
      amountPaidCents: 0,
      totalCents: 10000,
      creditedCents: 10000
    })

    expect(result).toEqual({ outcome: "settled" })
  })

  test("leaves a partly credited invoice with nothing paid unpaid", () => {
    const result = evaluateInvoiceSettlement({
      amountPaidCents: 0,
      totalCents: 10000,
      creditedCents: 3000
    })

    expect(result).toEqual({ outcome: "unpaid" })
  })

  test("still accepts the full total paid after a credit note, because that money did arrive", () => {
    const result = evaluateInvoiceSettlement({
      amountPaidCents: 10000,
      totalCents: 10000,
      creditedCents: 3000
    })

    expect(result).toEqual({ outcome: "settled" })
  })

  test("refuses payments beyond the total whatever has been credited", () => {
    const result = evaluateInvoiceSettlement({
      amountPaidCents: 10001,
      totalCents: 10000,
      creditedCents: 3000
    })

    expect(result).toEqual({ outcome: "overpaid", excessCents: 1 })
  })

  test("settles exactly when nothing is left outstanding", () => {
    const amounts = [0, 1, 2999, 3000, 7000, 9999, 10000]

    for (const amountPaidCents of amounts) {
      for (const creditedCents of amounts) {
        const invoice = { amountPaidCents, totalCents: 10000, creditedCents }

        const settled = evaluateInvoiceSettlement(invoice).outcome === "settled"

        expect(settled, JSON.stringify(invoice)).toBe(getInvoiceOutstandingCents(invoice) === 0)
      }
    }
  })
})

test("returns zero when there are no payments to sum", () => {
  expect(sumPaymentAmountCents([])).toBe(0)
})

test("sums payment amounts in integer cents", () => {
  const total = sumPaymentAmountCents([
    { amountCents: 3333 },
    { amountCents: 3333 },
    { amountCents: 3334 }
  ])

  expect(total).toBe(10000)
})
