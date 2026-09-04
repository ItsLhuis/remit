import { describe, expect, test } from "vitest"

import { matchesPublicToken, mintPublicToken } from "../publicToken"

describe("mintPublicToken", () => {
  test("returns the 43-character base64url encoding of 32 random bytes", () => {
    const token = mintPublicToken()

    expect(token).toHaveLength(43)
    expect(Buffer.from(token, "base64url")).toHaveLength(32)
  })

  test("emits only URL-safe base64 characters", () => {
    const tokens = Array.from({ length: 200 }, mintPublicToken)

    for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  test("never repeats a value across a large batch", () => {
    const tokens = Array.from({ length: 5_000 }, mintPublicToken)

    expect(new Set(tokens).size).toBe(tokens.length)
  })
})

describe("matchesPublicToken", () => {
  test("accepts a token identical to the stored one", () => {
    const token = mintPublicToken()

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
