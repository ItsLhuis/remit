import { describe, expect, test } from "vitest"

import {
  getReceivableCents,
  summarizeReceivables,
  type ReceivableInvoiceRow
} from "../summarizeReceivables"

function makeRow(overrides: Partial<ReceivableInvoiceRow> = {}): ReceivableInvoiceRow {
  return {
    currency: "EUR",
    totalCents: 100_000,
    amountPaidCents: 0,
    creditedCents: 0,
    isOverdue: false,
    ...overrides
  }
}

describe("getReceivableCents", () => {
  test("subtracts both payments and credit notes from the invoice total", () => {
    expect(
      getReceivableCents({ totalCents: 100_000, amountPaidCents: 25_000, creditedCents: 15_000 })
    ).toBe(60_000)
  })

  test("clamps to zero when credit notes exceed what is left to pay", () => {
    expect(
      getReceivableCents({ totalCents: 100_000, amountPaidCents: 40_000, creditedCents: 90_000 })
    ).toBe(0)
  })
})

describe("summarizeReceivables", () => {
  test("sums what is still owed net of credit notes", () => {
    const rows = [
      makeRow({ totalCents: 100_000, creditedCents: 20_000 }),
      makeRow({ totalCents: 50_000, amountPaidCents: 10_000 })
    ]

    const summary = summarizeReceivables(rows)

    expect(summary.outstanding).toEqual([{ currency: "EUR", totalCents: 120_000 }])
    expect(summary.outstandingCount).toBe(2)
  })

  test("counts an invoice fully cancelled by a credit note nowhere", () => {
    const rows = [makeRow({ totalCents: 100_000, creditedCents: 100_000 })]

    const summary = summarizeReceivables(rows)

    expect(summary.outstanding).toEqual([])
    expect(summary.outstandingCount).toBe(0)
  })

  test("counts an overdue invoice in both the outstanding and the overdue bucket", () => {
    const rows = [makeRow({ isOverdue: true }), makeRow({ isOverdue: false })]

    const summary = summarizeReceivables(rows)

    expect(summary.outstandingCount).toBe(2)
    expect(summary.overdueCount).toBe(1)
    expect(summary.overdue).toEqual([{ currency: "EUR", totalCents: 100_000 }])
  })

  test("leaves an overdue invoice out of the overdue bucket once it is fully credited", () => {
    const rows = [makeRow({ isOverdue: true, creditedCents: 100_000 })]

    const summary = summarizeReceivables(rows)

    expect(summary.overdueCount).toBe(0)
    expect(summary.overdue).toEqual([])
  })

  test("keeps each currency in its own bucket", () => {
    const rows = [
      makeRow({ currency: "EUR", totalCents: 10_000 }),
      makeRow({ currency: "USD", totalCents: 90_000 })
    ]

    const summary = summarizeReceivables(rows)

    expect(summary.outstanding).toEqual([
      { currency: "USD", totalCents: 90_000 },
      { currency: "EUR", totalCents: 10_000 }
    ])
  })

  test("returns empty buckets when there is nothing outstanding", () => {
    expect(summarizeReceivables([])).toEqual({
      outstanding: [],
      outstandingCount: 0,
      overdue: [],
      overdueCount: 0
    })
  })
})
