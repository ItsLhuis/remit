import { describe, expect, test } from "vitest"

import {
  evaluateProposalOtp,
  getProposalOtpExpiry,
  hasExhaustedProposalOtpAttempts,
  matchesProposalRecipient,
  PROPOSAL_OTP_MAX_ATTEMPTS,
  PROPOSAL_OTP_TTL_MINUTES,
  type ProposalOtpRecord
} from "../proposalOtp"

const now = new Date("2026-07-29T12:00:00.000Z")

function makeOtpRecord(overrides?: Partial<ProposalOtpRecord>): ProposalOtpRecord {
  return {
    expiresAt: new Date("2026-07-29T12:05:00.000Z"),
    attempts: 0,
    usedAt: null,
    invalidatedAt: null,
    ...overrides
  }
}

describe("evaluateProposalOtp", () => {
  test("accepts an unused code inside its window with attempts left", () => {
    expect(evaluateProposalOtp(makeOtpRecord(), now)).toEqual({ usable: true })
  })

  test("rejects a code that has already been used", () => {
    const otp = makeOtpRecord({ usedAt: new Date("2026-07-29T11:59:00.000Z") })

    expect(evaluateProposalOtp(otp, now)).toEqual({ usable: false, reason: "consumed" })
  })

  test("rejects a code that was superseded by a newer request", () => {
    const otp = makeOtpRecord({ invalidatedAt: new Date("2026-07-29T11:59:00.000Z") })

    expect(evaluateProposalOtp(otp, now)).toEqual({ usable: false, reason: "consumed" })
  })

  test("rejects a code whose expiry has passed", () => {
    const otp = makeOtpRecord({ expiresAt: new Date("2026-07-29T11:59:59.000Z") })

    expect(evaluateProposalOtp(otp, now)).toEqual({ usable: false, reason: "expired" })
  })

  test("rejects a code expiring exactly now", () => {
    const otp = makeOtpRecord({ expiresAt: now })

    expect(evaluateProposalOtp(otp, now)).toEqual({ usable: false, reason: "expired" })
  })

  test("rejects a code once the attempt ceiling is reached", () => {
    const otp = makeOtpRecord({ attempts: PROPOSAL_OTP_MAX_ATTEMPTS })

    expect(evaluateProposalOtp(otp, now)).toEqual({ usable: false, reason: "attempts_exhausted" })
  })

  test("still accepts a code one guess below the ceiling", () => {
    const otp = makeOtpRecord({ attempts: PROPOSAL_OTP_MAX_ATTEMPTS - 1 })

    expect(evaluateProposalOtp(otp, now)).toEqual({ usable: true })
  })

  test("reports consumption ahead of expiry when both apply", () => {
    const otp = makeOtpRecord({
      usedAt: new Date("2026-07-29T11:00:00.000Z"),
      expiresAt: new Date("2026-07-29T11:30:00.000Z")
    })

    expect(evaluateProposalOtp(otp, now)).toEqual({ usable: false, reason: "consumed" })
  })
})

test("expires a code the configured number of minutes after it is issued", () => {
  const expiry = getProposalOtpExpiry(now)

  expect(expiry.getTime() - now.getTime()).toBe(PROPOSAL_OTP_TTL_MINUTES * 60 * 1000)
})

test("reports attempts as exhausted only at or above the ceiling", () => {
  expect(hasExhaustedProposalOtpAttempts(PROPOSAL_OTP_MAX_ATTEMPTS - 1)).toBe(false)
  expect(hasExhaustedProposalOtpAttempts(PROPOSAL_OTP_MAX_ATTEMPTS)).toBe(true)
  expect(hasExhaustedProposalOtpAttempts(PROPOSAL_OTP_MAX_ATTEMPTS + 1)).toBe(true)
})

describe("matchesProposalRecipient", () => {
  test("accepts an address that differs only by case", () => {
    expect(matchesProposalRecipient("Client@Example.COM", "client@example.com")).toBe(true)
  })

  test("accepts an address that differs only by surrounding whitespace", () => {
    expect(matchesProposalRecipient("  client@example.com  ", "client@example.com")).toBe(true)
  })

  test("rejects a different address", () => {
    expect(matchesProposalRecipient("someone@example.com", "client@example.com")).toBe(false)
  })
})
