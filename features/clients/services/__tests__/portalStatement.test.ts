import { expect, test } from "vitest"

import { type ContractStatus } from "@/features/contracts/schemas"
// Deep-imported rather than taken from the contracts barrel on purpose: the barrel pulls that
// feature's `"use server"` modules, which boot `lib/config/env` and abort a unit run. `services/` is
// pure by rule, so this reaches the real definition and nothing else.
import { resolveContractDisplayStatus } from "@/features/contracts/services"

import { resolvePortalContractStatus, summarizePortalOutstanding } from "../portalStatement"

// The portal restates this rule instead of importing it, because a value import of the contracts
// barrel from this feature's server graph closes a dependency cycle. This is the pin that keeps the
// restatement honest: every status, against a window that is open, closed and absent.
const CONTRACT_STATUSES: ContractStatus[] = ["draft", "sent", "signed", "expired", "terminated"]

const NOW = new Date("2026-07-15T12:00:00.000Z")

test("reads a contract exactly as the contracts feature reads it", () => {
  const windows = [null, new Date("2026-07-14T00:00:00.000Z"), new Date("2026-07-15T00:00:00.000Z")]

  for (const status of CONTRACT_STATUSES) {
    for (const effectiveUntil of windows) {
      expect(resolvePortalContractStatus(status, effectiveUntil, NOW)).toBe(
        resolveContractDisplayStatus(status, effectiveUntil, NOW)
      )
    }
  }
})

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
