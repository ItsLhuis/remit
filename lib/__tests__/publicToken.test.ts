import { randomBytes } from "node:crypto"

import { describe, expect, test } from "vitest"

import { matchesPublicToken } from "../publicToken"

describe("matchesPublicToken", () => {
  test("accepts a token identical to the stored one", () => {
    const token = randomBytes(32).toString("base64url")

    expect(matchesPublicToken(token, token)).toBe(true)
  })

  test("rejects a token that differs in a single character", () => {
    const stored = "a".repeat(43)
    const candidate = `${"a".repeat(42)}b`

    expect(matchesPublicToken(candidate, stored)).toBe(false)
  })

  test("rejects a shorter candidate without throwing", () => {
    expect(matchesPublicToken("abc", "a".repeat(43))).toBe(false)
  })

  test("rejects a longer candidate without throwing", () => {
    expect(matchesPublicToken("a".repeat(200), "a".repeat(43))).toBe(false)
  })

  test("rejects an empty candidate against a stored token", () => {
    expect(matchesPublicToken("", "a".repeat(43))).toBe(false)
  })

  test("treats the comparison as case-sensitive", () => {
    const stored = "abc".repeat(14).concat("d")

    expect(matchesPublicToken(stored.toUpperCase(), stored)).toBe(false)
  })
})
