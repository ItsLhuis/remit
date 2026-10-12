import { expect, test } from "vitest"

import { toRateLimitHeaders } from "../headers"

const NOW = Date.parse("2026-10-12T12:00:00.000Z")

const TOKEN_POLICY = { name: "token", max: 120, windowMs: 60_000 }

test("describes the policy and what remains of it while requests are admitted", () => {
  const headers = toRateLimitHeaders(
    { allowed: true, remaining: 87, resetAt: new Date(NOW + 41_200) },
    TOKEN_POLICY,
    NOW
  )

  expect(headers).toEqual({
    "RateLimit-Policy": '"token";q=120;w=60',
    RateLimit: '"token";r=87;t=42'
  })
})

test("adds when to retry once the policy refuses", () => {
  const headers = toRateLimitHeaders(
    { allowed: false, remaining: 0, resetAt: new Date(NOW + 9_000) },
    TOKEN_POLICY,
    NOW
  )

  expect(headers.RateLimit).toBe('"token";r=0;t=9')
  expect(headers["Retry-After"]).toBe("9")
})

test("never reports a reset in the past or tells a refused caller to retry at once", () => {
  const headers = toRateLimitHeaders(
    { allowed: false, remaining: 0, resetAt: new Date(NOW - 500) },
    TOKEN_POLICY,
    NOW
  )

  expect(headers.RateLimit).toBe('"token";r=0;t=0')
  expect(headers["Retry-After"]).toBe("1")
})
