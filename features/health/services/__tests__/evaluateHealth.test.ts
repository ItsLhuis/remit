import { describe, expect, test } from "vitest"

import {
  evaluateBackupFreshness,
  evaluateDiskUsage,
  evaluateEmailHealth,
  evaluatePublicUrl,
  evaluateRemoteStorageConfiguration,
  evaluateStripeHealth
} from "../evaluateHealth"

describe("evaluateEmailHealth", () => {
  test("returns notSetup when settings are missing", () => {
    const result = evaluateEmailHealth({
      hasSettingsRow: false,
      isConfigured: false,
      hasSuccessfulTest: false
    })

    expect(result).toBe("notSetup")
  })

  test("returns healthy when email is configured and tested", () => {
    const result = evaluateEmailHealth({
      hasSettingsRow: true,
      isConfigured: true,
      hasSuccessfulTest: true
    })

    expect(result).toBe("healthy")
  })

  test("returns attention when email is configured but untested", () => {
    const result = evaluateEmailHealth({
      hasSettingsRow: true,
      isConfigured: true,
      hasSuccessfulTest: false
    })

    expect(result).toBe("attention")
  })
})

describe("evaluateStripeHealth", () => {
  test("returns optional when stripe is not configured", () => {
    const result = evaluateStripeHealth({
      hasSettingsRow: true,
      isConfigured: false,
      hasSuccessfulTest: false
    })

    expect(result).toBe("optional")
  })

  test("returns healthy when stripe is configured and tested", () => {
    const result = evaluateStripeHealth({
      hasSettingsRow: true,
      isConfigured: true,
      hasSuccessfulTest: true
    })

    expect(result).toBe("healthy")
  })
})

describe("evaluateRemoteStorageConfiguration", () => {
  test("returns false when a non-s3 destination is missing an endpoint", () => {
    const result = evaluateRemoteStorageConfiguration({
      destination: "r2",
      accessKeyId: "key",
      bucket: "bucket",
      endpoint: null,
      region: "auto",
      secretAccessKey: "secret"
    })

    expect(result).toBe(false)
  })

  test("returns true when all required fields are present", () => {
    const result = evaluateRemoteStorageConfiguration({
      destination: "s3",
      accessKeyId: "key",
      bucket: "bucket",
      endpoint: null,
      region: "eu-west-1",
      secretAccessKey: "secret"
    })

    expect(result).toBe(true)
  })
})

describe("evaluateBackupFreshness", () => {
  test("returns missing when no successful backup exists", () => {
    const result = evaluateBackupFreshness({
      lastSuccessAt: null,
      now: new Date("2026-05-11T00:00:00.000Z"),
      warningAgeMs: 7 * 24 * 60 * 60 * 1000
    })

    expect(result).toBe("missing")
  })

  test("returns stale when the last backup exceeds the warning age", () => {
    const result = evaluateBackupFreshness({
      lastSuccessAt: new Date("2026-05-01T00:00:00.000Z"),
      now: new Date("2026-05-11T00:00:00.000Z"),
      warningAgeMs: 7 * 24 * 60 * 60 * 1000
    })

    expect(result).toBe("stale")
  })
})

describe("evaluateDiskUsage", () => {
  test("marks disk usage as attention when usage reaches the threshold", () => {
    const result = evaluateDiskUsage({
      availableBytes: 10,
      attentionPercent: 90,
      totalBytes: 100
    })

    expect(result).toEqual({
      availableBytes: 10,
      needsAttention: true,
      totalBytes: 100,
      usedPercent: 90
    })
  })

  test("returns zero usage when the total size is zero", () => {
    const result = evaluateDiskUsage({
      availableBytes: 0,
      totalBytes: 0
    })

    expect(result.usedPercent).toBe(0)
    expect(result.needsAttention).toBe(false)
  })
})

describe("evaluatePublicUrl", () => {
  test("returns true for a valid absolute url", () => {
    const result = evaluatePublicUrl("https://example.com")

    expect(result).toBe(true)
  })

  test("returns false for an invalid url", () => {
    const result = evaluatePublicUrl("not-a-url")

    expect(result).toBe(false)
  })
})
