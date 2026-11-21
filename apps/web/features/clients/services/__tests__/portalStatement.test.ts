import { expect, test } from "vitest"

import { summarizePortalOutstanding } from "../portalStatement"

test("returns nothing when every invoice is settled", () => {
  const totals = summarizePortalOutstanding([
    { currency: "EUR", outstandingCents: 0 },
    { currency: "EUR", outstandingCents: 0 }
  ])

  expect(totals).toEqual([])
})

test("adds up what is still owed within one currency", () => {
  const totals = summarizePortalOutstanding([
    { currency: "EUR", outstandingCents: 120000 },
    { currency: "EUR", outstandingCents: 45000 },
    { currency: "EUR", outstandingCents: 0 }
  ])

  expect(totals).toEqual([{ currency: "EUR", totalCents: 165000 }])
})

test("reports each currency separately rather than summing across them", () => {
  const totals = summarizePortalOutstanding([
    { currency: "EUR", outstandingCents: 100000 },
    { currency: "USD", outstandingCents: 50000 },
    { currency: "EUR", outstandingCents: 25000 }
  ])

  expect(totals).toEqual([
    { currency: "EUR", totalCents: 125000 },
    { currency: "USD", totalCents: 50000 }
  ])
})

test("ignores an overpaid invoice rather than crediting it against another", () => {
  const totals = summarizePortalOutstanding([
    { currency: "EUR", outstandingCents: -5000 },
    { currency: "EUR", outstandingCents: 30000 }
  ])

  expect(totals).toEqual([{ currency: "EUR", totalCents: 30000 }])
})
