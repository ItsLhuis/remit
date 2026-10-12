import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { toBetterAuthRateLimitStorage } from "../betterAuthStorage"
import { createInMemoryAdapter } from "../inMemoryAdapter"
import { type RateLimitAdapter } from "../types"

const NOW = new Date("2026-10-12T12:00:00.000Z")

const SIGN_IN_RULE = { window: 900, max: 10 }

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

test("admits a path's limit and refuses the request after it", async () => {
  const storage = toBetterAuthRateLimitStorage(createInMemoryAdapter())

  const decisions = []

  for (let attempt = 0; attempt < 11; attempt += 1) {
    decisions.push(await storage.consume?.("203.0.113.7|/sign-in/email", SIGN_IN_RULE))
  }

  expect(decisions.slice(0, 10).every((decision) => decision?.allowed)).toBe(true)
  expect(decisions[10]).toEqual({ allowed: false, retryAfter: 900 })
})

test("counts the rule's window and limit under a key of its own", async () => {
  const consume = vi.fn<RateLimitAdapter["consume"]>(async () => ({
    allowed: true,
    remaining: 2,
    resetAt: NOW
  }))
  const storage = toBetterAuthRateLimitStorage({ consume })

  await storage.consume?.("203.0.113.7|/request-password-reset", { window: 3600, max: 5 })

  expect(consume).toHaveBeenCalledWith("auth:203.0.113.7|/request-password-reset", 5, 3_600_000)
})

test("tells the caller to retry when the shared window closes, never sooner than a second", async () => {
  const resetAt = new Date(NOW.getTime() + 2_500)
  const storage = toBetterAuthRateLimitStorage({
    consume: async () => ({ allowed: false, remaining: 0, resetAt })
  })
  const closing = toBetterAuthRateLimitStorage({
    consume: async () => ({ allowed: false, remaining: 0, resetAt: NOW })
  })

  const refusal = await storage.consume?.("203.0.113.7|/sign-up/email", SIGN_IN_RULE)
  const lastMoment = await closing.consume?.("203.0.113.7|/sign-up/email", SIGN_IN_RULE)

  expect(refusal).toEqual({ allowed: false, retryAfter: 3 })
  expect(lastMoment).toEqual({ allowed: false, retryAfter: 1 })
})

test("leaves Better Auth's non-atomic fallback with nothing to count", async () => {
  const storage = toBetterAuthRateLimitStorage(createInMemoryAdapter())

  await storage.set("203.0.113.7|/sign-in/email", {
    key: "203.0.113.7|/sign-in/email",
    count: 99,
    lastRequest: NOW.getTime()
  })

  expect(await storage.get("203.0.113.7|/sign-in/email")).toBeNull()
})
