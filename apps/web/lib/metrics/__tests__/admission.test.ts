import { beforeEach, describe, expect, test, vi } from "vitest"

import { admitMetricsScrape } from "../admission"

const TOKEN = "metrics-token-for-tests-0123456789abcdefghij"

const mocks = vi.hoisted(() => ({
  env: { REMIT_METRICS_TOKEN: undefined as string | undefined },
  writeRateLimitTripAudit: vi.fn(async (..._args: unknown[]) => undefined),
  matchesPublicToken: vi.fn()
}))

vi.mock("@/lib/config/env", () => ({ env: mocks.env }))

vi.mock("@/lib/audit", () => ({ writeRateLimitTripAudit: mocks.writeRateLimitTripAudit }))

vi.mock("@/lib/i18n/server", () => ({ t: (key: string) => key }))

// The in-memory adapter in place of the Redis-backed `rateLimitInstance`: the limit test needs a real
// counter, and a unit test must never count in a shared Redis, where one run's requests would still
// be in the window when the next run starts.
vi.mock("@/lib/rateLimit", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/rateLimit")>()

  return { ...original, rateLimitInstance: original.createInMemoryAdapter() }
})

vi.mock("@/lib/publicToken", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/publicToken")>()

  mocks.matchesPublicToken.mockImplementation(original.matchesPublicToken)

  return { ...original, matchesPublicToken: mocks.matchesPublicToken }
})

let requestCounter = 0

// A distinct client address per request unless one is given, so the module-level rate-limit bucket
// one test fills is never the bucket another test reads.
function makeRequest(options: { authorization?: string; ip?: string } = {}): Request {
  requestCounter += 1

  const headers = new Headers({
    "x-forwarded-for": options.ip ?? `198.51.100.${requestCounter % 250}`
  })

  if (options.authorization !== undefined) headers.set("authorization", options.authorization)

  return new Request("http://localhost:3000/api/metrics", { headers })
}

beforeEach(() => {
  vi.clearAllMocks()

  mocks.env.REMIT_METRICS_TOKEN = TOKEN
})

describe("admitMetricsScrape", () => {
  test("admits a scrape carrying the configured token", async () => {
    const admission = await admitMetricsScrape(makeRequest({ authorization: `Bearer ${TOKEN}` }))

    expect(admission).toEqual({ outcome: "admitted" })
  })

  test("refuses a missing, wrong or malformed credential and a disabled endpoint alike", async () => {
    const outcomes = [
      await admitMetricsScrape(makeRequest()),
      await admitMetricsScrape(makeRequest({ authorization: `Bearer ${TOKEN.slice(1)}x` })),
      await admitMetricsScrape(makeRequest({ authorization: TOKEN }))
    ]

    mocks.env.REMIT_METRICS_TOKEN = undefined

    outcomes.push(await admitMetricsScrape(makeRequest({ authorization: `Bearer ${TOKEN}` })))

    expect(outcomes).toEqual(Array.from({ length: 4 }, () => ({ outcome: "refused" })))
  })

  test("compares the credential through the constant-time helper", async () => {
    await admitMetricsScrape(makeRequest({ authorization: "Bearer not-the-token" }))

    expect(mocks.matchesPublicToken).toHaveBeenCalledWith("not-the-token", TOKEN)
  })

  test("limits a caller and audits the trip whether or not metrics are enabled", async () => {
    mocks.env.REMIT_METRICS_TOKEN = undefined

    const outcomes: string[] = []

    for (let attempt = 0; attempt < 31; attempt++) {
      outcomes.push((await admitMetricsScrape(makeRequest({ ip: "203.0.113.77" }))).outcome)
    }

    const limited = await admitMetricsScrape(makeRequest({ ip: "203.0.113.77" }))

    expect(outcomes.slice(0, 30).every((outcome) => outcome === "refused")).toBe(true)
    expect(outcomes[30]).toBe("limited")
    expect(limited.outcome === "limited" ? limited.response.status : null).toBe(429)
    expect(mocks.writeRateLimitTripAudit).toHaveBeenCalledWith(
      { key: "api.metrics:203.0.113.77", windowMs: 60_000 },
      expect.objectContaining({ ipAddress: "203.0.113.77", metadata: { route: "/api/metrics" } })
    )
  })

  test("limits a caller holding the token too, so a 429 says nothing about the token", async () => {
    const outcomes: string[] = []

    for (let attempt = 0; attempt < 31; attempt++) {
      const request = makeRequest({ ip: "203.0.113.78", authorization: `Bearer ${TOKEN}` })

      outcomes.push((await admitMetricsScrape(request)).outcome)
    }

    expect(outcomes.slice(0, 30).every((outcome) => outcome === "admitted")).toBe(true)
    expect(outcomes[30]).toBe("limited")
  })
})
