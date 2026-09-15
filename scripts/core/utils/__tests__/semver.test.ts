import { describe, expect, test } from "vitest"

import { compareSemver, incrementSemver, InvalidSemverError } from "../semver"

describe("compareSemver", () => {
  test("returns zero when both versions are equal", () => {
    const result = compareSemver("1.4.2", "v1.4.2")

    expect(result).toBe(0)
  })

  test("returns one when the left version is ahead", () => {
    const result = compareSemver("1.10.0", "1.9.9")

    expect(result).toBe(1)
  })

  test("returns minus one when the left version is behind", () => {
    const result = compareSemver("1.4.2", "2.0.0")

    expect(result).toBe(-1)
  })

  test("orders a prerelease below the release it precedes", () => {
    const prereleaseFirst = compareSemver("2.0.0-rc.1", "2.0.0")
    const releaseFirst = compareSemver("2.0.0", "2.0.0-rc.1")

    expect(prereleaseFirst).toBe(-1)
    expect(releaseFirst).toBe(1)
  })

  test("ignores build metadata when comparing", () => {
    const result = compareSemver("1.0.0+build.7", "1.0.0")

    expect(result).toBe(0)
  })

  test("throws when either version is malformed", () => {
    expect(() => compareSemver("1.0", "1.0.0")).toThrow(InvalidSemverError)
    expect(() => compareSemver("1.0.0", "latest")).toThrow(InvalidSemverError)
  })
})

describe("incrementSemver", () => {
  test("increments the patch and keeps major and minor", () => {
    const result = incrementSemver("1.4.2", "patch")

    expect(result).toBe("1.4.3")
  })

  test("increments the minor and resets the patch", () => {
    const result = incrementSemver("1.4.2", "minor")

    expect(result).toBe("1.5.0")
  })

  test("increments the major and resets minor and patch", () => {
    const result = incrementSemver("1.4.2", "major")

    expect(result).toBe("2.0.0")
  })

  test("throws when the version is malformed", () => {
    expect(() => incrementSemver("1.4", "patch")).toThrow(InvalidSemverError)
  })

  test("refuses to increment a prerelease", () => {
    expect(() => incrementSemver("2.0.0-rc.1", "patch")).toThrow("prerelease")
  })
})
