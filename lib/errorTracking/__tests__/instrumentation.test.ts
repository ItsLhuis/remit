import { afterEach, beforeEach, describe, expect, test, vi, type Mock } from "vitest"

const mocks = vi.hoisted(() => ({
  env: {
    SENTRY_DSN: undefined as string | undefined,
    NODE_ENV: "production"
  },
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() },
  ensureBucket: vi.fn(async () => undefined),
  startErrorTracking: vi.fn()
}))

vi.mock("@/lib/config/env", () => ({ env: mocks.env }))

vi.mock("@/lib/logger", () => ({ logger: mocks.logger }))

vi.mock("@/lib/storage/s3", () => ({ ensureBucket: mocks.ensureBucket }))

vi.mock("@/features/activityLog/events", () => ({}))

vi.mock("@/features/webhooks/events", () => ({}))

vi.mock("@/lib/errorTracking", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/errorTracking")>()

  mocks.startErrorTracking.mockImplementation(original.startErrorTracking)

  return { ...original, startErrorTracking: mocks.startErrorTracking }
})

const PUBLIC_TOKEN = "Yk3mQ9vT2xL7pR4sN8wZ1cF6hB0jD5gU3eA9iO2nKqM"
const SESSION_COOKIE = "better-auth.session_token=ses_4Kd9mQ2xT7pL"
const CLIENT_NOTE = "Confidential under NDA: Acme merger closes on the 14th"

const REQUEST = {
  path: `/i/${PUBLIC_TOKEN}?download=1`,
  method: "GET",
  headers: { cookie: SESSION_COOKIE, "user-agent": "Mozilla/5.0" }
}

const CONTEXT = {
  routerKind: "App Router",
  routePath: "/i/[token]",
  routeType: "render",
  renderSource: "react-server-components",
  revalidateReason: undefined
} as const

let fetchMock: Mock<typeof fetch>

beforeEach(() => {
  fetchMock = vi.fn<typeof fetch>(async () => new Response(null, { status: 200 }))

  vi.stubGlobal("fetch", fetchMock)
  vi.stubEnv("NEXT_RUNTIME", "nodejs")
  vi.resetModules()
})

afterEach(() => {
  mocks.env.SENTRY_DSN = undefined

  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe("with SENTRY_DSN unset", () => {
  test("booting constructs no sender and a request error sends nothing", async () => {
    const { onRequestError, register } = await import("@/instrumentation")

    await register()
    await onRequestError(new Error(CLIENT_NOTE), REQUEST, CONTEXT)

    expect(mocks.startErrorTracking).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mocks.logger.error).not.toHaveBeenCalled()
  })
})

describe("with SENTRY_DSN set", () => {
  test("a request error reaches the receiver without its path, headers or message", async () => {
    mocks.env.SENTRY_DSN = "https://0123456789abcdef0123456789abcdef@errors.example.com/7"

    const { onRequestError, register } = await import("@/instrumentation")
    const { flushErrorReports } = await import("@/lib/errorTracking")

    await register()
    await onRequestError(new Error(`Failed rendering: ${CLIENT_NOTE}`), REQUEST, CONTEXT)
    await flushErrorReports(1_000)

    expect(fetchMock).toHaveBeenCalledTimes(1)

    const body = fetchMock.mock.calls[0][1]?.body as string

    expect(body).toContain('"route.path":"/i/[token]"')
    expect(body).toContain('"runtime":"server"')
    expect(body).not.toContain(PUBLIC_TOKEN)
    expect(body).not.toContain("download=1")
    expect(body).not.toContain("session_token")
    expect(body).not.toContain("Mozilla")
    expect(body).not.toContain(CLIENT_NOTE)
  })

  test("the log line keeps the withheld error under the event id it was sent with", async () => {
    mocks.env.SENTRY_DSN = "https://0123456789abcdef0123456789abcdef@errors.example.com/7"

    const { onRequestError, register } = await import("@/instrumentation")
    const { flushErrorReports } = await import("@/lib/errorTracking")
    const error = new Error("boom")

    await register()
    await onRequestError(error, REQUEST, CONTEXT)
    await flushErrorReports(1_000)

    const body = fetchMock.mock.calls[0][1]?.body as string
    const eventId = (JSON.parse(body.split("\n")[0]) as { event_id: string }).event_id

    expect(mocks.logger.error).toHaveBeenCalledWith(
      {
        action: "request.error",
        errorEventId: eventId,
        routePath: "/i/[token]",
        err: error
      },
      "Request error reported"
    )
  })
})
