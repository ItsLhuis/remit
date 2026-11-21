import { describe, expect, test } from "vitest"

import { summarizeCreditNotes, type CreditNoteSummaryInput } from "../summarizeCreditNotes"

function makeCreditNote(overrides?: Partial<CreditNoteSummaryInput>): CreditNoteSummaryInput {
  return {
    invoiceId: "invoice-1",
    currency: "EUR",
    totalCents: 10000,
    ...overrides
  }
}

describe("summarizeCreditNotes", () => {
  test("returns an empty summary when nothing has been credited", () => {
    const summary = summarizeCreditNotes([])

    expect(summary).toEqual({
      total: 0,
      invoicesCredited: 0,
      creditedByCurrency: [],
      averageCents: 0,
      hasSingleCurrency: true
    })
  })

  test("counts every credit note", () => {
    const summary = summarizeCreditNotes([makeCreditNote(), makeCreditNote(), makeCreditNote()])

    expect(summary.total).toBe(3)
  })

  test("counts an invoice once however many notes stand against it", () => {
    const summary = summarizeCreditNotes([
      makeCreditNote({ invoiceId: "invoice-1" }),
      makeCreditNote({ invoiceId: "invoice-1" }),
      makeCreditNote({ invoiceId: "invoice-2" })
    ])

    expect(summary.invoicesCredited).toBe(2)
  })

  test("sums credited value within a currency", () => {
    const summary = summarizeCreditNotes([
      makeCreditNote({ totalCents: 10000 }),
      makeCreditNote({ totalCents: 2500 })
    ])

    expect(summary.creditedByCurrency).toEqual([{ currency: "EUR", totalCents: 12500 }])
    expect(summary.hasSingleCurrency).toBe(true)
  })

  test("buckets by currency and orders the largest first rather than summing across rates", () => {
    const summary = summarizeCreditNotes([
      makeCreditNote({ currency: "EUR", totalCents: 5000 }),
      makeCreditNote({ currency: "USD", totalCents: 30000 })
    ])

    expect(summary.creditedByCurrency).toEqual([
      { currency: "USD", totalCents: 30000 },
      { currency: "EUR", totalCents: 5000 }
    ])
    expect(summary.hasSingleCurrency).toBe(false)
  })

  test("averages only within the leading currency", () => {
    const summary = summarizeCreditNotes([
      makeCreditNote({ currency: "USD", totalCents: 30000 }),
      makeCreditNote({ currency: "USD", totalCents: 10000 }),
      makeCreditNote({ currency: "EUR", totalCents: 900 })
    ])

    expect(summary.averageCents).toBe(20000)
  })

  test("rounds an average that lands between cents", () => {
    const summary = summarizeCreditNotes([
      makeCreditNote({ totalCents: 1000 }),
      makeCreditNote({ totalCents: 1001 })
    ])

    expect(summary.averageCents).toBe(1001)
  })
})
