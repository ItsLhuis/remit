import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { createInMemoryAdapter } from "../inMemoryAdapter"
import { createRedisAdapter } from "../redisAdapter"

const mocks = vi.hoisted(() => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  getRateLimitConnection: vi.fn()
}))

vi.mock("@/lib/logger", () => ({ logger: mocks.logger }))

vi.mock("../connection", () => ({ getRateLimitConnection: mocks.getRateLimitConnection }))

// Only `Date` is faked: `resetAt` is derived from `Date.now()`, and nothing here waits on a timer.
const NOW = new Date("2026-09-10T12:00:00.000Z")

function createStore(...replies: Array<() => Promise<unknown>>) {
  const queue = [...replies]

  return { eval: vi.fn(() => (queue.shift() ?? replies[replies.length - 1])()) }
}

const reply = (count: number, remainingMs: number) => async () => [count, remainingMs]

const outage = async () => {
  throw new Error("Command timed out")
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe("Redis rate-limit adapter", () => {
  test("derives the reset time from the key's remaining TTL when the store answers", async () => {
    const store = createStore(reply(3, 40_000))
    const adapter = createRedisAdapter({
      getClient: () => store,
      fallback: createInMemoryAdapter()
    })

    const result = await adapter.consume("proposal.otp.request:203.0.113.7", 5, 60_000)

    expect(result).toEqual({
      allowed: true,
      remaining: 2,
      resetAt: new Date(NOW.getTime() + 40_000)
    })
  })

  test("refuses once the shared count passes the limit", async () => {
    const store = createStore(reply(6, 1_000))
    const adapter = createRedisAdapter({
      getClient: () => store,
      fallback: createInMemoryAdapter()
    })

    const result = await adapter.consume("contract.sign:203.0.113.7", 5, 60_000)

    expect(result.allowed).toBe(false)
  })

  test("keeps limiting per process when the store is unreachable", async () => {
    const store = createStore(outage)
    const adapter = createRedisAdapter({
      getClient: () => store,
      fallback: createInMemoryAdapter()
    })

    const results = [
      await adapter.consume("webhook.stripe:203.0.113.7", 2, 60_000),
      await adapter.consume("webhook.stripe:203.0.113.7", 2, 60_000),
      await adapter.consume("webhook.stripe:203.0.113.7", 2, 60_000)
    ]

    expect(results.map((result) => result.allowed)).toEqual([true, true, false])
  })

  test("logs an outage once when it starts rather than on every request", async () => {
    const store = createStore(outage)
    const adapter = createRedisAdapter({
      getClient: () => store,
      fallback: createInMemoryAdapter()
    })

    await adapter.consume("client.portal:203.0.113.7", 30, 60_000)
    await adapter.consume("client.portal:203.0.113.7", 30, 60_000)

    expect(mocks.logger.error).toHaveBeenCalledTimes(1)
    expect(mocks.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ action: "rateLimit.consume", err: expect.any(Error) }),
      expect.any(String)
    )
  })

  test("treats a malformed store reply as an outage when the reply cannot be trusted", async () => {
    const store = createStore(async () => "OK")
    const adapter = createRedisAdapter({
      getClient: () => store,
      fallback: createInMemoryAdapter()
    })

    const result = await adapter.consume("invoice.checkout.start:203.0.113.7", 5, 60_000)

    expect(result).toEqual({
      allowed: true,
      remaining: 4,
      resetAt: new Date(NOW.getTime() + 60_000)
    })
    expect(mocks.logger.error).toHaveBeenCalledTimes(1)
  })

  test("logs the recovery once and counts in the store again when it returns", async () => {
    const store = createStore(outage, reply(1, 60_000), reply(2, 59_000))
    const adapter = createRedisAdapter({
      getClient: () => store,
      fallback: createInMemoryAdapter()
    })

    await adapter.consume("metrics:203.0.113.7", 30, 60_000)
    await adapter.consume("metrics:203.0.113.7", 30, 60_000)
    const result = await adapter.consume("metrics:203.0.113.7", 30, 60_000)

    expect(mocks.logger.info).toHaveBeenCalledTimes(1)
    expect(result.remaining).toBe(28)
  })

  test("opens no connection until the exported limiter is first asked to count", async () => {
    mocks.getRateLimitConnection.mockReturnValue(createStore(reply(1, 60_000)))

    const { rateLimitInstance } = await import("../index")

    expect(mocks.getRateLimitConnection).not.toHaveBeenCalled()

    const result = await rateLimitInstance.consume("203.0.113.7", 60, 60_000)

    expect(mocks.getRateLimitConnection).toHaveBeenCalledTimes(1)
    expect(result.remaining).toBe(59)
  })
})
