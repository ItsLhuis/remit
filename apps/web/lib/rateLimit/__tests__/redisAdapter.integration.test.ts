import { randomUUID } from "node:crypto"

import { afterAll, expect, test, vi } from "vitest"

import { env } from "@/lib/config/env"

import { createRateLimitConnection } from "../connection"
import { createInMemoryAdapter } from "../inMemoryAdapter"
import { createRedisAdapter } from "../redisAdapter"

const mocks = vi.hoisted(() => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() }
}))

vi.mock("@/lib/logger", () => ({ logger: mocks.logger }))

// Port 1 refuses every connection, which puts the client into its reconnect loop exactly the way a
// Redis container that has stopped does.
const UNREACHABLE_REDIS_URL = "redis://127.0.0.1:1"

const clients: ReturnType<typeof createRateLimitConnection>[] = []

function createAdapter() {
  const client = createRateLimitConnection(env.REDIS_URL)

  clients.push(client)

  return {
    client,
    adapter: createRedisAdapter({ getClient: () => client, fallback: createInMemoryAdapter() })
  }
}

// A fresh key per test, rather than a flush: the suite shares database 1 with the queue round-trip
// tests, and a `FLUSHDB` here would delete their jobs mid-run.
const uniqueKey = (label: string) => `test.${label}:${randomUUID()}`

afterAll(() => {
  for (const client of clients) client.disconnect()
})

test("allows exactly the limit when concurrent requests race on one key", async () => {
  const { adapter } = createAdapter()
  const key = uniqueKey("concurrency")

  const results = await Promise.all(
    Array.from({ length: 50 }, () => adapter.consume(key, 10, 60_000))
  )

  expect(results.filter((result) => result.allowed)).toHaveLength(10)
})

test("keeps counting across a restart when a new process takes over the key", async () => {
  const key = uniqueKey("restart")
  const before = createAdapter()

  await before.adapter.consume(key, 3, 60_000)
  await before.adapter.consume(key, 3, 60_000)
  await before.adapter.consume(key, 3, 60_000)
  await before.client.quit()

  const after = createAdapter()

  const result = await after.adapter.consume(key, 3, 60_000)

  expect(result.allowed).toBe(false)
})

test("expires the counter with its window and reports when it resets", async () => {
  const { client, adapter } = createAdapter()
  const key = uniqueKey("window")

  const startedAt = Date.now()
  const result = await adapter.consume(key, 1, 60_000)
  const ttl = await client.pttl(`remit:ratelimit:${key}`)

  expect(ttl).toBeGreaterThan(0)
  expect(ttl).toBeLessThanOrEqual(60_000)
  expect(result.resetAt.getTime()).toBeGreaterThan(startedAt)
  expect(result.resetAt.getTime()).toBeLessThanOrEqual(Date.now() + 60_000)
})

test("opens a new window once the previous one has expired", async () => {
  const { adapter } = createAdapter()
  const key = uniqueKey("reopen")

  await adapter.consume(key, 1, 200)
  const refused = await adapter.consume(key, 1, 200)

  await new Promise((resolve) => setTimeout(resolve, 300))

  const reopened = await adapter.consume(key, 1, 200)

  expect(refused.allowed).toBe(false)
  expect(reopened.allowed).toBe(true)
})

test("falls back within the command timeout and logs when Redis is unreachable", async () => {
  const client = createRateLimitConnection(UNREACHABLE_REDIS_URL)
  const adapter = createRedisAdapter({ getClient: () => client, fallback: createInMemoryAdapter() })

  const startedAt = Date.now()
  const result = await adapter.consume(uniqueKey("outage"), 5, 60_000)
  const elapsedMs = Date.now() - startedAt

  client.disconnect()

  expect(result.allowed).toBe(true)
  expect(elapsedMs).toBeLessThan(1_500)
  expect(mocks.logger.error).toHaveBeenCalledTimes(1)
})
