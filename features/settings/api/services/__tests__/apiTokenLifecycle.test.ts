import { describe, expect, test } from "vitest"

import { getApiTokenStatus, resolveApiTokenExpiry } from "../apiTokenLifecycle"

const now = new Date("2026-09-11T12:00:00.000Z")

describe("API token lifecycle", () => {
  test("sets an expiry the chosen number of days ahead", () => {
    expect(resolveApiTokenExpiry("30", now)).toEqual(new Date("2026-10-11T12:00:00.000Z"))
    expect(resolveApiTokenExpiry("365", now)).toEqual(new Date("2027-09-11T12:00:00.000Z"))
  })

  test("sets no expiry when the owner chooses never", () => {
    expect(resolveApiTokenExpiry("never", now)).toBeNull()
  })

  test("reports a revoked token as revoked even before its expiry", () => {
    const status = getApiTokenStatus(
      { revokedAt: now, expiresAt: new Date("2027-01-01T00:00:00.000Z") },
      now
    )

    expect(status).toBe("revoked")
  })

  test("reports a token as expired from the instant its expiry arrives", () => {
    expect(getApiTokenStatus({ revokedAt: null, expiresAt: now }, now)).toBe("expired")
  })

  test("reports a token with no expiry and no revocation as active", () => {
    expect(getApiTokenStatus({ revokedAt: null, expiresAt: null }, now)).toBe("active")
  })
})
