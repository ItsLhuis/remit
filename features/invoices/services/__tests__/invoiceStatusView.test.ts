import { describe, expect, test } from "vitest"

import {
  deriveInvoiceStatusView,
  getInvoiceOutstandingCents,
  isInvoiceOverdue,
  isInvoicePartiallyPaid,
  type InvoiceStatusViewInput
} from "../invoiceStatusView"

const NOW = new Date("2026-08-02T12:00:00.000Z")

function makeInvoice(overrides?: Partial<InvoiceStatusViewInput>): InvoiceStatusViewInput {
  return {
    status: "sent",
    dueDate: new Date("2026-08-31T00:00:00.000Z"),
    paidAt: null,
    amountPaidCents: 0,
    totalCents: 100000,
    ...overrides
  }
}

describe("deriveInvoiceStatusView", () => {
  test("returns the stored status when nothing is derived", () => {
    expect(deriveInvoiceStatusView(makeInvoice(), NOW)).toBe("sent")
  })

  test("reports overdue once the due date has passed with nothing paid", () => {
    const invoice = makeInvoice({ dueDate: new Date("2026-08-01T00:00:00.000Z") })

    expect(deriveInvoiceStatusView(invoice, NOW)).toBe("overdue")
  })

  test("does not report overdue on the due date itself", () => {
    const invoice = makeInvoice({ dueDate: new Date("2026-08-02T00:00:00.000Z") })

    expect(deriveInvoiceStatusView(invoice, NOW)).toBe("sent")
  })

  test("reports partially paid when some money has arrived and the invoice is not late", () => {
    const invoice = makeInvoice({ amountPaidCents: 40000 })

    expect(deriveInvoiceStatusView(invoice, NOW)).toBe("partially_paid")
  })

  test("prefers overdue over partially paid when both apply", () => {
    const invoice = makeInvoice({
      amountPaidCents: 40000,
      dueDate: new Date("2026-07-01T00:00:00.000Z")
    })

    expect(deriveInvoiceStatusView(invoice, NOW)).toBe("overdue")
  })

  test("reports paid whatever the due date says", () => {
    const invoice = makeInvoice({
      status: "paid",
      amountPaidCents: 100000,
      paidAt: new Date("2026-07-15T00:00:00.000Z"),
      dueDate: new Date("2026-07-01T00:00:00.000Z")
    })

    expect(deriveInvoiceStatusView(invoice, NOW)).toBe("paid")
  })

  test("never reports a draft as overdue", () => {
    const invoice = makeInvoice({
      status: "draft",
      dueDate: new Date("2026-01-01T00:00:00.000Z")
    })

    expect(deriveInvoiceStatusView(invoice, NOW)).toBe("draft")
  })

  test("never reports overdue for an invoice with no due date", () => {
    expect(deriveInvoiceStatusView(makeInvoice({ dueDate: null }), NOW)).toBe("sent")
  })

  test("reports a draft carrying a payment as partially paid", () => {
    const invoice = makeInvoice({ status: "draft", amountPaidCents: 40000 })

    expect(deriveInvoiceStatusView(invoice, NOW)).toBe("partially_paid")
  })
})

describe("isInvoiceOverdue", () => {
  test("is false once a payment timestamp exists even past the due date", () => {
    const invoice = makeInvoice({
      dueDate: new Date("2026-07-01T00:00:00.000Z"),
      paidAt: new Date("2026-06-30T00:00:00.000Z")
    })

    expect(isInvoiceOverdue(invoice, NOW)).toBe(false)
  })
})

describe("isInvoicePartiallyPaid", () => {
  test("is false when nothing has been paid", () => {
    expect(isInvoicePartiallyPaid({ amountPaidCents: 0, totalCents: 100000 })).toBe(false)
  })

  test("is false when the invoice is settled in full", () => {
    expect(isInvoicePartiallyPaid({ amountPaidCents: 100000, totalCents: 100000 })).toBe(false)
  })

  test("is true between zero and the total", () => {
    expect(isInvoicePartiallyPaid({ amountPaidCents: 1, totalCents: 100000 })).toBe(true)
  })

  test("is still true one cent below the total", () => {
    expect(isInvoicePartiallyPaid({ amountPaidCents: 99999, totalCents: 100000 })).toBe(true)
  })
})

describe("getInvoiceOutstandingCents", () => {
  test("returns the unpaid remainder in integer cents", () => {
    expect(getInvoiceOutstandingCents({ amountPaidCents: 40000, totalCents: 100000 })).toBe(60000)
  })

  test("clamps at zero when more has been applied than the total", () => {
    expect(getInvoiceOutstandingCents({ amountPaidCents: 120000, totalCents: 100000 })).toBe(0)
  })
})
