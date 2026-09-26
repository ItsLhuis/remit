import { expect, test } from "vitest"

import { calculateOutstandingBalanceCents } from "../calculateOutstandingBalance"

test("returns zero when a client has no invoices", () => {
  const result = calculateOutstandingBalanceCents([])

  expect(result).toBe(0)
})

test("ignores draft invoices when computing outstanding balance", () => {
  const result = calculateOutstandingBalanceCents([
    { status: "draft", totalCents: 120000, paidCents: 0, creditedCents: 0 },
    { status: "sent", totalCents: 50000, paidCents: 10000, creditedCents: 0 }
  ])

  expect(result).toBe(40000)
})

test("subtracts payments from sent and paid invoices using integer cents", () => {
  const result = calculateOutstandingBalanceCents([
    { status: "sent", totalCents: 10000, paidCents: 2500, creditedCents: 0 },
    { status: "paid", totalCents: 8000, paidCents: 8000, creditedCents: 0 }
  ])

  expect(result).toBe(7500)
})

test("clamps overpaid invoice groups to zero", () => {
  const result = calculateOutstandingBalanceCents([
    { status: "sent", totalCents: 10000, paidCents: 12000, creditedCents: 0 }
  ])

  expect(result).toBe(0)
})

test("nets the credit notes issued against each invoice", () => {
  const result = calculateOutstandingBalanceCents([
    { status: "sent", totalCents: 10000, paidCents: 2000, creditedCents: 3000 }
  ])

  expect(result).toBe(5000)
})

test("does not let one over-credited invoice reduce what another still owes", () => {
  const result = calculateOutstandingBalanceCents([
    { status: "sent", totalCents: 10000, paidCents: 5000, creditedCents: 9000 },
    { status: "sent", totalCents: 20000, paidCents: 0, creditedCents: 0 }
  ])

  expect(result).toBe(20000)
})

test("rejects non-integer money inputs", () => {
  expect(() =>
    calculateOutstandingBalanceCents([
      { status: "sent", totalCents: 100.5, paidCents: 0, creditedCents: 0 }
    ])
  ).toThrow("Money values must be safe integer cents")
})
