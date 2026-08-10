import { describe, expect, test } from "vitest"

import { summarizeTopClients, type ClientRevenueRow } from "../summarizeTopClients"

function makeRow(overrides: Partial<ClientRevenueRow> = {}): ClientRevenueRow {
  return {
    clientId: "client-1",
    clientName: "Acme",
    currency: "EUR",
    amountCents: 10_000,
    ...overrides
  }
}

describe("summarizeTopClients", () => {
  test("adds every payment a client made into one row", () => {
    const rows = [makeRow({ amountCents: 10_000 }), makeRow({ amountCents: 5000 })]

    expect(summarizeTopClients(rows, "EUR")).toEqual([
      { clientId: "client-1", name: "Acme", revenueCents: 15_000, sharePercentage: 100 }
    ])
  })

  test("orders clients by revenue, largest first", () => {
    const rows = [
      makeRow({ clientId: "small", clientName: "Small", amountCents: 1000 }),
      makeRow({ clientId: "large", clientName: "Large", amountCents: 9000 })
    ]

    expect(summarizeTopClients(rows, "EUR").map((client) => client.clientId)).toEqual([
      "large",
      "small"
    ])
  })

  test("computes each client's share of the shown revenue", () => {
    const rows = [
      makeRow({ clientId: "a", amountCents: 7500 }),
      makeRow({ clientId: "b", amountCents: 2500 })
    ]

    expect(summarizeTopClients(rows, "EUR").map((client) => client.sharePercentage)).toEqual([
      75, 25
    ])
  })

  test("rounds a share to a tenth of a percent", () => {
    const rows = [
      makeRow({ clientId: "a", amountCents: 1 }),
      makeRow({ clientId: "b", amountCents: 2 })
    ]

    expect(summarizeTopClients(rows, "EUR")[0]?.sharePercentage).toBe(66.7)
  })

  test("ignores revenue recorded in another currency", () => {
    const rows = [
      makeRow({ clientId: "eur", amountCents: 1000, currency: "EUR" }),
      makeRow({ clientId: "usd", amountCents: 9000, currency: "USD" })
    ]

    expect(summarizeTopClients(rows, "EUR")).toEqual([
      { clientId: "eur", name: "Acme", revenueCents: 1000, sharePercentage: 100 }
    ])
  })

  test("caps the list at the requested limit", () => {
    const rows = Array.from({ length: 8 }, (_, index) =>
      makeRow({ clientId: `client-${index}`, amountCents: index + 1 })
    )

    expect(summarizeTopClients(rows, "EUR")).toHaveLength(5)
  })

  test("returns nothing when no payment was made in the requested currency", () => {
    expect(summarizeTopClients([makeRow({ currency: "USD" })], "EUR")).toEqual([])
  })
})
