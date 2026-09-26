import { describe, expect, test } from "vitest"

import { computeInvoiceEffectiveReceivable, sumCreditNoteTotalCents } from "../effectiveReceivable"

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
