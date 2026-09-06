import { describe, expect, test } from "vitest"

import { buildInvoiceCheckoutIdempotencyKey, decideInvoiceCheckout } from "../invoiceCheckout"

describe("decideInvoiceCheckout", () => {
  test("charges the full total when nothing has been paid", () => {
    const decision = decideInvoiceCheckout({
      status: "sent",
      totalCents: 30000,
      amountPaidCents: 0,
      stripeConfigured: true
    })

    expect(decision).toEqual({ payable: true, amountCents: 30000 })
  })

  test("charges only the outstanding balance when the invoice is partially paid", () => {
    const decision = decideInvoiceCheckout({
      status: "sent",
      totalCents: 30000,
      amountPaidCents: 12500,
      stripeConfigured: true
    })

    expect(decision).toEqual({ payable: true, amountCents: 17500 })
  })

  test("refuses when Stripe is not configured", () => {
    const decision = decideInvoiceCheckout({
      status: "sent",
      totalCents: 30000,
      amountPaidCents: 0,
      stripeConfigured: false
    })

    expect(decision).toEqual({ payable: false, reason: "not_configured" })
  })

  test("refuses a draft invoice", () => {
    const decision = decideInvoiceCheckout({
      status: "draft",
      totalCents: 30000,
      amountPaidCents: 0,
      stripeConfigured: true
    })

    expect(decision).toEqual({ payable: false, reason: "invoice_not_issued" })
  })

  test("refuses an invoice that is already paid in full", () => {
    const decision = decideInvoiceCheckout({
      status: "paid",
      totalCents: 30000,
      amountPaidCents: 30000,
      stripeConfigured: true
    })

    expect(decision).toEqual({ payable: false, reason: "nothing_outstanding" })
  })

  test("refuses an invoice with a zero total", () => {
    const decision = decideInvoiceCheckout({
      status: "sent",
      totalCents: 0,
      amountPaidCents: 0,
      stripeConfigured: true
    })

    expect(decision).toEqual({ payable: false, reason: "nothing_outstanding" })
  })

  test("refuses an invoice whose recorded payments exceed its total", () => {
    const decision = decideInvoiceCheckout({
      status: "sent",
      totalCents: 30000,
      amountPaidCents: 45000,
      stripeConfigured: true
    })

    expect(decision).toEqual({ payable: false, reason: "nothing_outstanding" })
  })
})

describe("buildInvoiceCheckoutIdempotencyKey", () => {
  test("returns the same key for the same invoice and amount", () => {
    const first = buildInvoiceCheckoutIdempotencyKey("6f1b2c9e-0000-4000-8000-000000000001", 17500)
    const second = buildInvoiceCheckoutIdempotencyKey("6f1b2c9e-0000-4000-8000-000000000001", 17500)

    expect(first).toBe(second)
  })

  test("returns a different key once the outstanding amount changes", () => {
    const before = buildInvoiceCheckoutIdempotencyKey("6f1b2c9e-0000-4000-8000-000000000001", 30000)
    const after = buildInvoiceCheckoutIdempotencyKey("6f1b2c9e-0000-4000-8000-000000000001", 17500)

    expect(before).not.toBe(after)
  })

  test("returns a different key for a different invoice at the same amount", () => {
    const first = buildInvoiceCheckoutIdempotencyKey("6f1b2c9e-0000-4000-8000-000000000001", 30000)
    const second = buildInvoiceCheckoutIdempotencyKey("6f1b2c9e-0000-4000-8000-000000000002", 30000)

    expect(first).not.toBe(second)
  })
})
