import { expect, test } from "vitest"

import { evaluateInvoiceSettlement, sumPaymentAmountCents } from "../paymentSettlement"

test("reports an invoice with no payments as unpaid", () => {
  const result = evaluateInvoiceSettlement({ amountPaidCents: 0, totalCents: 10000 })

  expect(result).toEqual({ outcome: "unpaid" })
})

test("reports a partial payment when some but not all of the total has arrived", () => {
  const result = evaluateInvoiceSettlement({ amountPaidCents: 4000, totalCents: 10000 })

  expect(result).toEqual({ outcome: "partial" })
})

test("reports settled when the payments reach the total exactly", () => {
  const result = evaluateInvoiceSettlement({ amountPaidCents: 10000, totalCents: 10000 })

  expect(result).toEqual({ outcome: "settled" })
})

test("reports the excess when the payments exceed the total", () => {
  const result = evaluateInvoiceSettlement({ amountPaidCents: 10001, totalCents: 10000 })

  expect(result).toEqual({ outcome: "overpaid", excessCents: 1 })
})

test("treats one cent below the total as partial rather than settled", () => {
  const result = evaluateInvoiceSettlement({ amountPaidCents: 9999, totalCents: 10000 })

  expect(result).toEqual({ outcome: "partial" })
})

test("does not call a zero-total invoice settled", () => {
  const result = evaluateInvoiceSettlement({ amountPaidCents: 0, totalCents: 0 })

  expect(result).toEqual({ outcome: "unpaid" })
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
