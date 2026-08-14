import { describe, expect, test } from "vitest"

// The pure services entry rather than the feature barrel: that barrel reaches components and through
// them `lib/auth`, which validates the environment at import time and exits a unit-test process.
import { MERGE_VARIABLES } from "@/features/templates/services"

import { buildCreditNoteRenderData, type CreditNoteRenderDataInput } from "../creditNoteRenderData"

function makeInput(overrides: Partial<CreditNoteRenderDataInput> = {}): CreditNoteRenderDataInput {
  return {
    creditNote: {
      number: "CN-0001",
      reason: "Overcharged",
      currency: "EUR",
      subtotalCents: 50_000,
      taxAmountCents: 11_500,
      totalCents: 61_500,
      issuedAt: new Date(Date.UTC(2026, 7, 1))
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
    payment: {
      iban: "IE29AIBK93115212345678",
      bankName: "Bank",
      instructions: null,
      termsDays: 30
    },
    lineItems: [],
    locale: "en",
    ...overrides
  }
}

describe("buildCreditNoteRenderData", () => {
  test("provides a value for every merge variable the credit note type whitelists", () => {
    const values = buildCreditNoteRenderData(makeInput()).values

    const missing = MERGE_VARIABLES.credit_note.filter((variable) => !(variable in values))

    expect(missing).toEqual([])
  })

  // The refund has to say where the money goes back to, which is why this type whitelists the
  // payment group where a proposal does not.
  test("carries the payment details a refund is returned to", () => {
    const values = buildCreditNoteRenderData(makeInput()).values

    expect(values["payment.iban"]).toBe("IE29AIBK93115212345678")
  })

  test("formats totals from integer minor units", () => {
    const values = buildCreditNoteRenderData(makeInput()).values

    expect(values["creditNote.total"]).toBe("€615.00")
  })
})
