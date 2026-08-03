import { describe, expect, test } from "vitest"

import {
  computeInvoiceEffectiveReceivable,
  computeInvoiceOutstandingAfterCredits,
  sumCreditNoteTotalCents
} from "../effectiveReceivable"

describe("sumCreditNoteTotalCents", () => {
  test("returns zero when no credit notes stand against the invoice", () => {
    expect(sumCreditNoteTotalCents([])).toBe(0)
  })

  test("adds every credit note total", () => {
    expect(sumCreditNoteTotalCents([2500, 1000, 750])).toBe(4250)
  })
})

describe("computeInvoiceEffectiveReceivable", () => {
  test("returns the invoice total unchanged when there are no credit notes", () => {
    expect(computeInvoiceEffectiveReceivable(120000, [])).toBe(120000)
  })

  test("reduces the receivable by a partial credit", () => {
    expect(computeInvoiceEffectiveReceivable(120000, [20000])).toBe(100000)
  })

  test("reduces the receivable by every credit note standing against the invoice", () => {
    expect(computeInvoiceEffectiveReceivable(120000, [20000, 15000])).toBe(85000)
  })

  test("returns zero when the credits exactly match the invoice total", () => {
    expect(computeInvoiceEffectiveReceivable(120000, [120000])).toBe(0)
  })

  test("floors at zero when the invoice is over-credited", () => {
    expect(computeInvoiceEffectiveReceivable(120000, [100000, 50000])).toBe(0)
  })

  test("returns zero for a zero-total invoice", () => {
    expect(computeInvoiceEffectiveReceivable(0, [])).toBe(0)
  })
})

describe("computeInvoiceOutstandingAfterCredits", () => {
  test("falls back to total minus paid when there are no credit notes", () => {
    expect(
      computeInvoiceOutstandingAfterCredits({ totalCents: 120000, amountPaidCents: 30000 }, [])
    ).toBe(90000)
  })

  test("subtracts credits before payments so a credited invoice owes less", () => {
    expect(
      computeInvoiceOutstandingAfterCredits({ totalCents: 120000, amountPaidCents: 30000 }, [20000])
    ).toBe(70000)
  })

  test("returns zero once credits and payments together cover the invoice", () => {
    expect(
      computeInvoiceOutstandingAfterCredits(
        { totalCents: 120000, amountPaidCents: 100000 },
        [20000]
      )
    ).toBe(0)
  })

  test("floors at zero when a credit is issued after the invoice was already paid in full", () => {
    expect(
      computeInvoiceOutstandingAfterCredits(
        { totalCents: 120000, amountPaidCents: 120000 },
        [30000]
      )
    ).toBe(0)
  })

  test("floors at zero when the invoice is over-credited and unpaid", () => {
    expect(
      computeInvoiceOutstandingAfterCredits({ totalCents: 120000, amountPaidCents: 0 }, [200000])
    ).toBe(0)
  })
})
