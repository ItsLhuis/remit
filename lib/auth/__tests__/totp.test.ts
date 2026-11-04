import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { generateTotpCode } from "@/tests/e2e/support/totp"

import { buildTotpUri, verifyTotpCode } from "../totp"

const NOW = new Date("2026-03-02T10:00:12.000Z").getTime()
const PERIOD = 30
const DIGITS = 6
const SECRET = "Kq3vX9pLm2Rt7Wz4Bn8Yc5Hd1Jf6Gs0A"

const totpUri = buildTotpUri({
  secret: SECRET,
  issuer: "Remit",
  account: "owner@example.com",
  digits: DIGITS,
  period: PERIOD
})

// `generateTotpCode` reads `Date.now()`, so the frozen clock is what puts the authenticator and the
// verifier on the same step, and moving it is how a code from another step is made.
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe("verifying a code", () => {
  test("accepts the code an authenticator derives from the URI secret when the step is current", () => {
    const code = authenticatorCodeAt(NOW)

    const accepted = verifySecretCode(code)

    expect(accepted).toBe(true)
  })

  test("accepts the code of the previous step when it was typed just before the boundary", () => {
    const code = authenticatorCodeAt(NOW - PERIOD * 1000)

    const accepted = verifySecretCode(code)

    expect(accepted).toBe(true)
  })

  test("accepts the code of the next step when the authenticator clock runs ahead", () => {
    const code = authenticatorCodeAt(NOW + PERIOD * 1000)

    const accepted = verifySecretCode(code)

    expect(accepted).toBe(true)
  })

  test("refuses a code when it is two steps away", () => {
    const earlier = authenticatorCodeAt(NOW - 2 * PERIOD * 1000)
    const later = authenticatorCodeAt(NOW + 2 * PERIOD * 1000)

    expect(verifySecretCode(earlier)).toBe(false)
    expect(verifySecretCode(later)).toBe(false)
  })

  test("refuses a code when no step in the window produces it", () => {
    const accepted = verifySecretCode("000000")

    expect(accepted).toBe(false)
  })

  test("refuses a code when its length differs from the configured digits", () => {
    const code = authenticatorCodeAt(NOW)

    expect(verifySecretCode(code.slice(0, DIGITS - 1))).toBe(false)
    expect(verifySecretCode(`${code}0`)).toBe(false)
  })

  test("accepts the current code when the clock is in the first step and the previous one is negative", () => {
    const code = authenticatorCodeAt(10_000)

    const accepted = verifyTotpCode({
      secret: SECRET,
      code,
      digits: DIGITS,
      period: PERIOD,
      now: 10_000
    })

    expect(accepted).toBe(true)
  })

  test("accepts the RFC 6238 SHA-1 reference code when the time is its reference time", () => {
    const accepted = verifyTotpCode({
      secret: "12345678901234567890",
      code: "94287082",
      digits: 8,
      period: 30,
      now: 59_000
    })

    expect(accepted).toBe(true)
  })
})

describe("building the URI", () => {
  test("builds the otpauth URI with the secret, issuer, digits and period in Better Auth's order", () => {
    const uri = buildTotpUri({
      secret: "12345678901234567890",
      issuer: "Remit",
      account: "owner@example.com",
      digits: 6,
      period: 30
    })

    expect(uri).toBe(
      "otpauth://totp/Remit:owner%40example.com?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=Remit&digits=6&period=30"
    )
  })

  test("encodes the issuer and the account in the label when they carry reserved characters", () => {
    const uri = buildTotpUri({
      secret: SECRET,
      issuer: "Remit & Co",
      account: "owner+mfa@example.com",
      digits: DIGITS,
      period: PERIOD
    })

    expect(uri.startsWith("otpauth://totp/Remit%20%26%20Co:owner%2Bmfa%40example.com?")).toBe(true)
    expect(new URL(uri).searchParams.get("issuer")).toBe("Remit & Co")
  })

  test("carries the secret as base32 without padding when its bytes do not fill a block", () => {
    const uri = buildTotpUri({
      secret: "a",
      issuer: "Remit",
      account: "owner@example.com",
      digits: DIGITS,
      period: PERIOD
    })

    expect(new URL(uri).searchParams.get("secret")).toBe("ME")
  })
})

function authenticatorCodeAt(time: number): string {
  const uriSecret = new URL(totpUri).searchParams.get("secret") ?? ""

  vi.setSystemTime(time)

  const code = generateTotpCode(uriSecret)

  vi.setSystemTime(NOW)

  return code
}

function verifySecretCode(code: string): boolean {
  return verifyTotpCode({ secret: SECRET, code, digits: DIGITS, period: PERIOD, now: NOW })
}
