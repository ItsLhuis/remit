import { describe, expect, test } from "vitest"

import {
  API_TOKEN_PREFIX,
  getApiTokenDisplayPrefix,
  hashApiToken,
  isWellFormedApiToken,
  issueApiToken,
  matchesApiTokenHash,
  parseBearerCredential
} from "../apiToken"

describe("API token credentials", () => {
  test("issues a prefixed token whose stored hash and display prefix both derive from it", () => {
    const issued = issueApiToken()

    expect(issued.token.startsWith(API_TOKEN_PREFIX)).toBe(true)
    expect(isWellFormedApiToken(issued.token)).toBe(true)
    expect(issued.tokenHash).toBe(hashApiToken(issued.token))
    expect(issued.tokenPrefix).toBe(getApiTokenDisplayPrefix(issued.token))
  })

  test("issues a different token on every call", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => issueApiToken().token))

    expect(tokens.size).toBe(50)
  })

  test("persists nothing from which the token could be read back when it is issued", () => {
    const issued = issueApiToken()

    expect(issued.tokenHash).not.toContain(issued.token.slice(API_TOKEN_PREFIX.length))
    expect(issued.tokenPrefix.length).toBeLessThan(issued.token.length / 3)
  })

  test("refuses a credential without the prefix or of the wrong length", () => {
    const issued = issueApiToken()

    expect(isWellFormedApiToken(issued.token.slice(API_TOKEN_PREFIX.length))).toBe(false)
    expect(isWellFormedApiToken(`${issued.token}x`)).toBe(false)
    expect(isWellFormedApiToken(`${API_TOKEN_PREFIX}short`)).toBe(false)
  })

  test("matches a hash only against the identical digest", () => {
    const hash = hashApiToken(issueApiToken().token)

    expect(matchesApiTokenHash(hash, hash)).toBe(true)
    expect(matchesApiTokenHash(hashApiToken(issueApiToken().token), hash)).toBe(false)
    expect(matchesApiTokenHash(hash.slice(2), hash)).toBe(false)
    expect(matchesApiTokenHash("", "")).toBe(false)
  })

  test("reads the credential from a bearer authorization header and from nothing else", () => {
    expect(parseBearerCredential("Bearer remit_abc")).toBe("remit_abc")
    expect(parseBearerCredential("Basic remit_abc")).toBeNull()
    expect(parseBearerCredential("Bearer remit abc")).toBeNull()
    expect(parseBearerCredential(null)).toBeNull()
  })
})
