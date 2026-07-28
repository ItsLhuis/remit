import { describe, expect, test } from "vitest"

import { summarizeProposals } from "../summarizeProposals"

describe("summarizeProposals", () => {
  test("returns zeroes for an empty project", () => {
    expect(summarizeProposals([])).toEqual({
      total: 0,
      draft: 0,
      awaiting: 0,
      accepted: 0,
      acceptedValueByCurrency: [],
      hasSingleCurrency: true
    })
  })

  test("counts each status and sums only the accepted value", () => {
    const summary = summarizeProposals([
      { status: "draft", currency: "EUR", totalCents: 10000 },
      { status: "sent", currency: "EUR", totalCents: 20000 },
      { status: "accepted", currency: "EUR", totalCents: 30000 },
      { status: "accepted", currency: "EUR", totalCents: 5000 },
      { status: "rejected", currency: "EUR", totalCents: 40000 }
    ])

    expect(summary).toEqual({
      total: 5,
      draft: 1,
      awaiting: 1,
      accepted: 2,
      acceptedValueByCurrency: [{ currency: "EUR", totalCents: 35000 }],
      hasSingleCurrency: true
    })
  })

  test("keeps accepted value in separate buckets per currency, largest first", () => {
    const summary = summarizeProposals([
      { status: "accepted", currency: "EUR", totalCents: 15000 },
      { status: "accepted", currency: "USD", totalCents: 90000 },
      { status: "accepted", currency: "EUR", totalCents: 5000 }
    ])

    expect(summary.acceptedValueByCurrency).toEqual([
      { currency: "USD", totalCents: 90000 },
      { currency: "EUR", totalCents: 20000 }
    ])
    expect(summary.hasSingleCurrency).toBe(false)
  })

  test("reports a single currency when only one currency has accepted value", () => {
    const summary = summarizeProposals([
      { status: "accepted", currency: "EUR", totalCents: 15000 },
      { status: "sent", currency: "USD", totalCents: 90000 }
    ])

    expect(summary.acceptedValueByCurrency).toEqual([{ currency: "EUR", totalCents: 15000 }])
    expect(summary.hasSingleCurrency).toBe(true)
  })
})
