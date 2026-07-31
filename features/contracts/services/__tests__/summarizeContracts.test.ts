import { expect, test } from "vitest"

import { summarizeContracts } from "../summarizeContracts"

const now = new Date("2026-07-31T12:00:00.000Z")

test("counts contracts by display status", () => {
  const rows = [
    { status: "draft" as const, effectiveUntil: null },
    { status: "sent" as const, effectiveUntil: null },
    { status: "sent" as const, effectiveUntil: new Date("2026-07-01T00:00:00.000Z") },
    { status: "signed" as const, effectiveUntil: null },
    { status: "terminated" as const, effectiveUntil: null }
  ]

  const result = summarizeContracts(rows, now)

  expect(result).toEqual({ total: 5, draft: 1, sent: 1, signed: 1, expired: 1, terminated: 1 })
})

test("returns zeroed counts for no contracts", () => {
  expect(summarizeContracts([], now)).toEqual({
    total: 0,
    draft: 0,
    sent: 0,
    signed: 0,
    expired: 0,
    terminated: 0
  })
})
