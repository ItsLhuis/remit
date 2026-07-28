import { describe, expect, test } from "vitest"

import { calculateProposalValidUntil, formatProposalNumber } from "../proposalNumber"

describe("formatProposalNumber", () => {
  test("pads the counter to the configured width", () => {
    expect(formatProposalNumber({ prefix: "PROP-", nextNumber: 42, paddingWidth: 4 })).toBe(
      "PROP-0042"
    )
  })

  test("keeps every digit when the counter is wider than the padding", () => {
    expect(formatProposalNumber({ prefix: "PROP-", nextNumber: 100000, paddingWidth: 4 })).toBe(
      "PROP-100000"
    )
  })

  test("emits the bare counter when the padding width is zero", () => {
    expect(formatProposalNumber({ prefix: "Q", nextNumber: 7, paddingWidth: 0 })).toBe("Q7")
  })
})

describe("calculateProposalValidUntil", () => {
  test("adds the validity window in whole UTC days", () => {
    const validUntil = calculateProposalValidUntil(new Date("2026-07-27T22:30:00.000Z"), 30)

    expect(validUntil?.toISOString()).toBe("2026-08-26T00:00:00.000Z")
  })

  test("crosses a month boundary correctly", () => {
    const validUntil = calculateProposalValidUntil(new Date("2026-01-31T00:00:00.000Z"), 1)

    expect(validUntil?.toISOString()).toBe("2026-02-01T00:00:00.000Z")
  })

  test("returns null when the instance has no validity window configured", () => {
    expect(calculateProposalValidUntil(new Date("2026-07-27T00:00:00.000Z"), 0)).toBeNull()
  })
})
