import { describe, expect, test } from "vitest"

// The pure services entry rather than the feature barrel: the barrel reaches components and through
// them `lib/auth`, which validates the environment at import time and exits a unit-test process.
import { MERGE_VARIABLES } from "@/features/templates/services"

import {
  buildInvoiceRenderData,
  type InvoiceRenderDataInput,
  type InvoiceRenderLineItem
} from "../invoiceRenderData"

function makeInput(overrides: Partial<InvoiceRenderDataInput> = {}): InvoiceRenderDataInput {
  return {
    invoice: {
      number: "INV-0001",
      currency: "EUR",
      subtotalCents: 100_000,
      discountAmountTotalCents: 0,
      taxAmountCents: 23_000,
      totalCents: 123_000,
      amountPaidCents: 0,
      lateFeeCents: null,
      exchangeRate: null,
      issueDate: new Date(Date.UTC(2026, 7, 1)),
      dueDate: new Date(Date.UTC(2026, 7, 31)),
      paidAt: null,
      notes: null
    },
    client: null,
    business: {
      name: "Remit",
      email: null,
      phone: null,
      website: null,
      taxId: null,
      addressLine1: null,
      addressLine2: null,
      city: null,
      state: null,
      postalCode: null,
      country: null
    },
    payment: { iban: null, bankName: null, instructions: null, termsDays: 30 },
    lineItems: [],
    statusLabel: "Sent",
    locale: "en",
    ...overrides
  }
}

function makeLineItem(overrides: Partial<InvoiceRenderLineItem> = {}): InvoiceRenderLineItem {
  return {
    description: "Design work",
    unit: "hour",
    quantity: "10.00",
    unitPriceCents: 10_000,
    discountType: null,
    discountPercentage: null,
    discountAmountCents: null,
    taxPercentageSnapshot: "23.00",
    subtotalCents: 100_000,
    taxAmountCents: 23_000,
    totalCents: 123_000,
    ...overrides
  }
}

describe("buildInvoiceRenderData", () => {
  // A token whose key is absent renders as its raw `{{...}}` source in the finished document, so a
  // variable added to the whitelist without a key here is a visible defect on a money document.
  // This is the assertion that keeps the two lists in step.
  test("provides a value for every merge variable the invoice type whitelists", () => {
    const values = buildInvoiceRenderData(makeInput()).values

    const missing = MERGE_VARIABLES.invoice.filter((variable) => !(variable in values))

    expect(missing).toEqual([])
  })

  test("bills the outstanding amount rather than the face value when partly paid", () => {
    const values = buildInvoiceRenderData(
      makeInput({
        invoice: { ...makeInput().invoice, amountPaidCents: 23_000 }
      })
    ).values

    expect(values["invoice.amountDue"]).toBe("€1,000.00")
    expect(values["invoice.total"]).toBe("€1,230.00")
  })

  test("renders a percentage line discount as a percentage", () => {
    const data = buildInvoiceRenderData(
      makeInput({
        lineItems: [makeLineItem({ discountType: "percentage", discountPercentage: "10.00" })]
      })
    )

    expect(data.lineItems?.[0]?.["lineItem.discount"]).toBe("10.00%")
  })

  test("renders a fixed line discount as money", () => {
    const data = buildInvoiceRenderData(
      makeInput({
        lineItems: [makeLineItem({ discountType: "fixed", discountAmountCents: 5_000 })]
      })
    )

    expect(data.lineItems?.[0]?.["lineItem.discount"]).toBe("€50.00")
  })

  test("leaves an absent late fee blank rather than printing zero", () => {
    expect(buildInvoiceRenderData(makeInput()).values["invoice.lateFee"]).toBe("")
  })
})
