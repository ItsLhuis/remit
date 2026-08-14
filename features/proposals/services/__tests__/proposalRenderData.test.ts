import { describe, expect, test } from "vitest"

// The pure services entry rather than the feature barrel: that barrel reaches components and through
// them `lib/auth`, which validates the environment at import time and exits a unit-test process.
import { MERGE_VARIABLES } from "@/features/templates/services"

import { buildProposalRenderData, type ProposalRenderDataInput } from "../proposalRenderData"

function makeInput(overrides: Partial<ProposalRenderDataInput> = {}): ProposalRenderDataInput {
  return {
    proposal: {
      number: "PRO-0001",
      currency: "EUR",
      subtotalCents: 100_000,
      discountAmountTotalCents: 10_000,
      taxAmountCents: 20_700,
      totalCents: 110_700,
      validUntil: new Date(Date.UTC(2026, 8, 1)),
      issuedAt: new Date(Date.UTC(2026, 7, 1)),
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
    lineItems: [],
    statusLabel: "Sent",
    locale: "en",
    ...overrides
  }
}

describe("buildProposalRenderData", () => {
  // A token whose key is absent renders as its raw `{{...}}` source in the finished document, so a
  // variable added to the whitelist without a key here is a visible defect on a document a client
  // receives. This is the assertion that keeps the two lists in step.
  test("provides a value for every merge variable the proposal type whitelists", () => {
    const values = buildProposalRenderData(makeInput()).values

    const missing = MERGE_VARIABLES.proposal.filter((variable) => !(variable in values))

    expect(missing).toEqual([])
  })

  // A proposal takes no payment, so its whitelist omits the group entirely. Emitting bank details on
  // a document that never asks for money would be a real leak, not a cosmetic one.
  test("emits no payment details", () => {
    const values = buildProposalRenderData(makeInput()).values

    expect(Object.keys(values).some((key) => key.startsWith("payment."))).toBe(false)
  })

  test("formats the validity date and the discount from integer minor units", () => {
    const values = buildProposalRenderData(makeInput()).values

    expect(values["proposal.discount"]).toBe("€100.00")
    expect(values["proposal.validUntil"]).not.toBe("")
  })
})
