import { expect, test } from "vitest"

import { summarizeClients, type ClientSummaryRow } from "../summarizeClients"

const NOW = new Date("2026-06-08T12:00:00.000Z")

function makeRow(overrides: Partial<ClientSummaryRow> = {}): ClientSummaryRow {
  return {
    currency: "EUR",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    outstandingBalanceCents: 0,
    invoiceCount: 0,
    ...overrides
  }
}

test("counts total clients from the provided rows", () => {
  const rows = [makeRow(), makeRow(), makeRow()]

  const summary = summarizeClients(rows, NOW)

  expect(summary.totalClients).toBe(3)
})

test("counts only clients with a positive outstanding balance as owing", () => {
  const rows = [
    makeRow({ outstandingBalanceCents: 1000 }),
    makeRow({ outstandingBalanceCents: 0 }),
    makeRow({ outstandingBalanceCents: 250 })
  ]

  const summary = summarizeClients(rows, NOW)

  expect(summary.owingClients).toBe(2)
})

test("counts clients created within the window as new", () => {
  const rows = [
    makeRow({ createdAt: new Date("2026-06-01T00:00:00.000Z") }),
    makeRow({ createdAt: new Date("2026-05-20T00:00:00.000Z") }),
    makeRow({ createdAt: new Date("2026-01-01T00:00:00.000Z") })
  ]

  const summary = summarizeClients(rows, NOW)

  expect(summary.newClients).toBe(2)
})

test("aggregates outstanding totals per currency sorted by largest first", () => {
  const rows = [
    makeRow({ currency: "EUR", outstandingBalanceCents: 1000 }),
    makeRow({ currency: "USD", outstandingBalanceCents: 5000 }),
    makeRow({ currency: "EUR", outstandingBalanceCents: 500 })
  ]

  const summary = summarizeClients(rows, NOW)

  expect(summary.outstandingByCurrency).toEqual([
    { currency: "USD", totalCents: 5000 },
    { currency: "EUR", totalCents: 1500 }
  ])
  expect(summary.hasSingleCurrency).toBe(false)
})

test("treats a single owing currency as single currency", () => {
  const rows = [
    makeRow({ currency: "EUR", outstandingBalanceCents: 1000 }),
    makeRow({ currency: "USD", outstandingBalanceCents: 0 })
  ]

  const summary = summarizeClients(rows, NOW)

  expect(summary.hasSingleCurrency).toBe(true)
  expect(summary.outstandingByCurrency).toEqual([{ currency: "EUR", totalCents: 1000 }])
})

test("classifies each client into a single health bucket", () => {
  const rows = [
    makeRow({ outstandingBalanceCents: 1000, invoiceCount: 2 }),
    makeRow({ outstandingBalanceCents: 0, invoiceCount: 3 }),
    makeRow({ outstandingBalanceCents: 0, invoiceCount: 0 }),
    makeRow({ outstandingBalanceCents: 0, invoiceCount: 1 })
  ]

  const summary = summarizeClients(rows, NOW)

  expect(summary.healthDistribution).toEqual({ owing: 1, settled: 2, dormant: 1 })
})

test("builds a six-month acquisition trend with cumulative totals", () => {
  const rows = [
    makeRow({ createdAt: new Date("2026-01-15T00:00:00.000Z") }),
    makeRow({ createdAt: new Date("2026-05-10T00:00:00.000Z") }),
    makeRow({ createdAt: new Date("2026-06-02T00:00:00.000Z") })
  ]

  const summary = summarizeClients(rows, NOW)

  expect(summary.acquisitionTrend).toEqual([
    { month: "2026-01", newClients: 1, totalClients: 1 },
    { month: "2026-02", newClients: 0, totalClients: 1 },
    { month: "2026-03", newClients: 0, totalClients: 1 },
    { month: "2026-04", newClients: 0, totalClients: 1 },
    { month: "2026-05", newClients: 1, totalClients: 2 },
    { month: "2026-06", newClients: 1, totalClients: 3 }
  ])
})

test("returns an empty summary when there are no clients", () => {
  const summary = summarizeClients([], NOW)

  expect(summary).toEqual({
    totalClients: 0,
    owingClients: 0,
    newClients: 0,
    outstandingByCurrency: [],
    hasSingleCurrency: true,
    healthDistribution: { owing: 0, settled: 0, dormant: 0 },
    acquisitionTrend: [
      { month: "2026-01", newClients: 0, totalClients: 0 },
      { month: "2026-02", newClients: 0, totalClients: 0 },
      { month: "2026-03", newClients: 0, totalClients: 0 },
      { month: "2026-04", newClients: 0, totalClients: 0 },
      { month: "2026-05", newClients: 0, totalClients: 0 },
      { month: "2026-06", newClients: 0, totalClients: 0 }
    ]
  })
})
