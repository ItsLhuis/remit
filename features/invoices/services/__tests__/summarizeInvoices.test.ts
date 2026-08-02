import { describe, expect, test } from "vitest"

import { summarizeInvoices, type InvoiceSummaryInput } from "../summarizeInvoices"

const NOW = new Date("2026-08-02T12:00:00.000Z")

function makeInvoice(overrides?: Partial<InvoiceSummaryInput>): InvoiceSummaryInput {
  return {
    status: "sent",
    currency: "EUR",
    totalCents: 100000,
    amountPaidCents: 0,
    dueDate: new Date("2026-08-31T00:00:00.000Z"),
    paidAt: null,
    ...overrides
  }
}

describe("summarizeInvoices", () => {
  test("returns an empty summary for no invoices", () => {
    const summary = summarizeInvoices([], NOW)

    expect(summary).toEqual({
      total: 0,
      draft: 0,
      awaiting: 0,
      overdue: 0,
      paid: 0,
      outstandingByCurrency: [],
      hasSingleCurrency: true
    })
  })

  test("counts each stored status into its own bucket", () => {
    const summary = summarizeInvoices(
      [
        makeInvoice({ status: "draft" }),
        makeInvoice({ status: "sent" }),
        makeInvoice({ status: "paid", amountPaidCents: 100000, paidAt: NOW })
      ],
      NOW
    )

    expect(summary.total).toBe(3)
    expect(summary.draft).toBe(1)
    expect(summary.awaiting).toBe(1)
    expect(summary.paid).toBe(1)
  })

  test("counts an overdue invoice as awaiting as well", () => {
    const summary = summarizeInvoices(
      [makeInvoice({ dueDate: new Date("2026-07-01T00:00:00.000Z") })],
      NOW
    )

    expect(summary.overdue).toBe(1)
    expect(summary.awaiting).toBe(1)
  })

  test("counts only the unpaid remainder as outstanding", () => {
    const summary = summarizeInvoices([makeInvoice({ amountPaidCents: 40000 })], NOW)

    expect(summary.outstandingByCurrency).toEqual([{ currency: "EUR", totalCents: 60000 }])
  })

  test("excludes drafts and paid invoices from the outstanding total", () => {
    const summary = summarizeInvoices(
      [
        makeInvoice({ status: "draft" }),
        makeInvoice({ status: "paid", amountPaidCents: 100000, paidAt: NOW })
      ],
      NOW
    )

    expect(summary.outstandingByCurrency).toEqual([])
  })

  test("buckets outstanding value per currency, largest first", () => {
    const summary = summarizeInvoices(
      [
        makeInvoice({ currency: "EUR", totalCents: 50000 }),
        makeInvoice({ currency: "USD", totalCents: 120000 })
      ],
      NOW
    )

    expect(summary.outstandingByCurrency).toEqual([
      { currency: "USD", totalCents: 120000 },
      { currency: "EUR", totalCents: 50000 }
    ])
    expect(summary.hasSingleCurrency).toBe(false)
  })
})
