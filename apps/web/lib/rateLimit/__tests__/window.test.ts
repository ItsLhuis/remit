import { describe, expect, test } from "vitest"

import { parseWindowReply, toRateLimitKey, toRateLimitResult } from "../window"

const NOW = Date.UTC(2026, 8, 10, 12, 0, 0)

describe("rate-limit window arithmetic", () => {
  test("namespaces every counter under one prefix when building a key", () => {
    expect(toRateLimitKey("proposal.otp.request:203.0.113.7")).toBe(
      "remit:ratelimit:proposal.otp.request:203.0.113.7"
    )
  })

  test("allows a request and counts down when the count is within the limit", () => {
    const result = toRateLimitResult([3, 40_000], 5, NOW)

    expect(result).toEqual({ allowed: true, remaining: 2, resetAt: new Date(NOW + 40_000) })
  })

  test("allows the request that reaches the limit exactly", () => {
    const result = toRateLimitResult([5, 1_000], 5, NOW)

    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(0)
  })

  test("refuses and never reports a negative remainder when the count passes the limit", () => {
    const result = toRateLimitResult([9, 1_000], 5, NOW)

    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  test("never reports a reset time in the past when the key has no remaining TTL", () => {
    const result = toRateLimitResult([1, -1], 5, NOW)

    expect(result.resetAt).toEqual(new Date(NOW))
  })

  test("accepts a count and a TTL when the store replies with both", () => {
    expect(parseWindowReply([2, 59_000])).toEqual([2, 59_000])
  })

  test.each([[null], [["2", 59_000]], [[0, 59_000]], [[2]], [[2, 1.5]]])(
    "rejects a malformed store reply %j",
    (reply) => {
      expect(() => parseWindowReply(reply)).toThrow()
    }
  )
})
