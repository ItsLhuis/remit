import { afterEach, beforeEach, describe, expect, test, vi, type Mock } from "vitest"

import { type ErrorReportContext } from "../errorEvent"

const mocks = vi.hoisted(() => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

vi.mock("@/lib/logger", () => ({ logger: mocks.logger }))

const DSN = "https://0123456789abcdef0123456789abcdef@errors.example.com/7"
const ENVELOPE_URL = "https://errors.example.com/api/7/envelope/"

const JOB_CONTEXT: ErrorReportContext = {
  source: "job",
  jobName: "invoice.pdf.render",
  attempts: 5
}

const OPTIONS = {
  dsn: DSN,
  runtime: "worker",
  release: "1.0.0",
  environment: "production"
} as const

// Each test loads a fresh copy of the module, because whether a sender exists is module state and
// the first test's `startErrorTracking` must not leak into the next one's "never started".
async function loadReporter(): Promise<typeof import("../reporter")> {
  vi.resetModules()

  return import("../reporter")
}

let fetchMock: Mock<typeof fetch>

beforeEach(() => {
  fetchMock = vi.fn<typeof fetch>(async () => new Response(null, { status: 200 }))

  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe("without a DSN", () => {
  test("nothing is sent and no event id is returned when tracking was never started", async () => {
    const { flushErrorReports, reportError } = await loadReporter()

    const eventId = reportError(new Error("boom"), JOB_CONTEXT)
    await flushErrorReports(50)

    expect(eventId).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mocks.logger.info).not.toHaveBeenCalled()
  })

  test("a DSN it cannot read constructs nothing", async () => {
    const { reportError, startErrorTracking } = await loadReporter()

    const started = startErrorTracking({ ...OPTIONS, dsn: "https://errors.example.com/7" })
    const eventId = reportError(new Error("boom"), JOB_CONTEXT)

    expect(started).toBe(false)
    expect(eventId).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("with a DSN", () => {
  test("posts one envelope to the project's endpoint, authenticated by the public key alone", async () => {
    const { flushErrorReports, reportError, startErrorTracking } = await loadReporter()

    startErrorTracking(OPTIONS)
    const eventId = reportError(new Error("render failed"), JOB_CONTEXT)
    await flushErrorReports(1_000)

    expect(eventId).toMatch(/^[0-9a-f]{32}$/)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [url, init] = fetchMock.mock.calls[0]
    const headers = init?.headers as Record<string, string>
    const body = init?.body as string
    const [envelopeHeader, itemHeader, payload] = body.split("\n")

    expect(url).toBe(ENVELOPE_URL)
    expect(headers["Content-Type"]).toBe("application/x-sentry-envelope")
    expect(headers["X-Sentry-Auth"]).toContain("sentry_key=0123456789abcdef0123456789abcdef")
    expect(JSON.parse(envelopeHeader)).toMatchObject({ event_id: eventId })
    expect(JSON.parse(envelopeHeader)).not.toHaveProperty("dsn")
    expect(JSON.parse(itemHeader)).toEqual({ type: "event" })
    expect(JSON.parse(payload)).toMatchObject({
      event_id: eventId,
      tags: { runtime: "worker", "job.name": "invoice.pdf.render" }
    })
    expect(body).not.toContain("render failed")
  })

  test("an event it cannot classify is dropped and nothing is sent", async () => {
    const { reportError, startErrorTracking } = await loadReporter()

    startErrorTracking(OPTIONS)
    const eventId = reportError(new Error("boom"), {
      source: "request",
      routePath: "/i/Yk3mQ9vT2xL7pR4sN8wZ1cF6hB0jD5gU3eA9iO2nKqM",
      routeType: "render"
    })

    expect(eventId).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mocks.logger.warn).toHaveBeenCalledTimes(1)
  })

  test("an unreachable receiver never throws into the caller and is logged once per outage", async () => {
    fetchMock.mockRejectedValue(
      new TypeError("fetch failed", {
        cause: Object.assign(new Error("connect ECONNREFUSED 10.0.0.9:8000"), {
          code: "ECONNREFUSED"
        })
      })
    )

    const { flushErrorReports, reportError, startErrorTracking } = await loadReporter()

    startErrorTracking(OPTIONS)
    reportError(new Error("first"), JOB_CONTEXT)
    reportError(new Error("second"), JOB_CONTEXT)
    await flushErrorReports(1_000)

    expect(mocks.logger.warn).toHaveBeenCalledTimes(1)
    expect(mocks.logger.warn).toHaveBeenCalledWith(
      { action: "errorTracking.deliver", reason: "ECONNREFUSED" },
      "Error events are not reaching the receiver"
    )
    expect(JSON.stringify(mocks.logger.warn.mock.calls)).not.toContain("errors.example.com")
  })

  test("recovery after a failed delivery is logged", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }))

    const { flushErrorReports, reportError, startErrorTracking } = await loadReporter()

    startErrorTracking(OPTIONS)
    reportError(new Error("first"), JOB_CONTEXT)
    await flushErrorReports(1_000)
    reportError(new Error("second"), JOB_CONTEXT)
    await flushErrorReports(1_000)

    expect(mocks.logger.warn).toHaveBeenCalledWith(
      { action: "errorTracking.deliver", status: 503 },
      "Error events are not reaching the receiver"
    )
    expect(mocks.logger.info).toHaveBeenLastCalledWith(
      { action: "errorTracking.deliver" },
      "Error events are reaching the receiver again"
    )
  })

  test("drops events past five unanswered sends instead of opening more", async () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => undefined))

    const { reportError, startErrorTracking } = await loadReporter()

    startErrorTracking(OPTIONS)
    const eventIds = Array.from({ length: 7 }, () => reportError(new Error("storm"), JOB_CONTEXT))

    expect(fetchMock).toHaveBeenCalledTimes(5)
    expect(eventIds.filter((eventId) => eventId === null)).toHaveLength(2)
  })

  test("a flush gives up at its bound when the receiver never answers", async () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => undefined))

    const { flushErrorReports, reportError, startErrorTracking } = await loadReporter()

    startErrorTracking(OPTIONS)
    reportError(new Error("hang"), JOB_CONTEXT)

    await expect(flushErrorReports(20)).resolves.toBeUndefined()
  })
})
