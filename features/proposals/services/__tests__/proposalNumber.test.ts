import { describe, expect, test } from "vitest"

import {
  calculateProposalValidUntil,
  formatProposalNumber,
  isProposalExpired
} from "../proposalNumber"

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

describe("isProposalExpired", () => {
  test("treats the validity date itself as still open", () => {
    const validUntil = new Date("2026-07-29T00:00:00.000Z")

    expect(isProposalExpired(validUntil, new Date("2026-07-29T23:59:59.000Z"))).toBe(false)
  })

  test("expires once the UTC date has moved past the validity date", () => {
    const validUntil = new Date("2026-07-29T00:00:00.000Z")

    expect(isProposalExpired(validUntil, new Date("2026-07-30T00:00:00.000Z"))).toBe(true)
  })

  test("never expires a proposal with no validity date", () => {
    expect(isProposalExpired(null, new Date("2030-01-01T00:00:00.000Z"))).toBe(false)
  })
})
