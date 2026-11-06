import { NextRequest } from "next/server"

import { beforeEach, describe, expect, test, vi } from "vitest"

const USER_ID = "00000000-0000-0000-0000-000000000001"
const REQUEST_IP = "203.0.113.1"
const REQUEST_USER_AGENT = "vitest"
const USER_ID_PREDICATE = "user id predicate"
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000

const requestAuditContext = {
  ipAddress: REQUEST_IP,
  userAgent: REQUEST_USER_AGENT
}

const userAuditContext = {
  ...requestAuditContext,
  actorUserId: USER_ID,
  targetEntityId: USER_ID,
  targetEntityType: "user"
}

const mocks = vi.hoisted(() => ({
  betterAuthGet: vi.fn(() => new Response(null, { status: 204 })),
  betterAuthPost: vi.fn(),
  writeAudit: vi.fn(),
  countRateLimitTrip: vi.fn(),
  getSession: vi.fn(),
  loggerError: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
  update: vi.fn(),
  eq: vi.fn()
}))

vi.mock("better-auth/next-js", () => ({
  toNextJsHandler: vi.fn(() => ({
    GET: mocks.betterAuthGet,
    POST: mocks.betterAuthPost
  }))
}))

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: mocks.getSession
    }
  }
}))

vi.mock("@/lib/audit", () => ({
  writeAudit: mocks.writeAudit,
  // Forwards to the mocked `writeAudit`, so these assertions read the entry a refusal produces; the
  // one-entry-per-window counting itself is covered by `lib/rateLimit/__tests__/tripWindow.test.ts`.
  writeRateLimitTripAudit: (_trip: unknown, options: unknown) =>
    mocks.writeAudit("auth.rate_limit.tripped", options)
}))

vi.mock("@/lib/rateLimit", () => ({
  countRateLimitTrip: mocks.countRateLimitTrip
}))

vi.mock("@/lib/i18n/server", () => ({ t: (key: string) => key }))

vi.mock("@/lib/logger", () => ({
  logger: { error: mocks.loggerError }
}))

vi.mock("drizzle-orm", () => ({
  eq: mocks.eq
}))

vi.mock("@/database", () => ({
  database: {
    update: mocks.update
  }
}))

vi.mock("@/database/schema", () => ({
  users: {
    id: "users.id",
    mustChangePassword: "users.mustChangePassword"
  }
}))

function createRequest(path: string, body?: Record<string, unknown>): NextRequest {
  return new NextRequest(`https://remit.test/api/auth${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": REQUEST_USER_AGENT,
      "x-forwarded-for": `${REQUEST_IP}, 198.51.100.1`
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
}

async function importRoute(): Promise<typeof import("../route")> {
  return await import("../route")
}

async function postToAuthRoute(path: string, body?: Record<string, unknown>): Promise<Response> {
  const route = await importRoute()

  return await route.POST(createRequest(path, body))
}

describe("auth route audit wrapper", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.betterAuthPost.mockResolvedValue(new Response(null, { status: 204 }))
    mocks.countRateLimitTrip.mockResolvedValue({ write: true, suppressedSincePreviousEntry: 0 })
    mocks.getSession.mockResolvedValue({
      user: { id: USER_ID }
    })
    mocks.where.mockResolvedValue(undefined)
    mocks.set.mockReturnValue({ where: mocks.where })
    mocks.update.mockReturnValue({ set: mocks.set })
    mocks.eq.mockReturnValue(USER_ID_PREDICATE)
  })

  test("exports the Better Auth GET handler directly", async () => {
    const route = await importRoute()

    expect(route.GET).toBe(mocks.betterAuthGet)
  })

  test("delegates unaudited POST routes without writing audit logs", async () => {
    const request = createRequest("/session")
    const route = await importRoute()

    await route.POST(request)

    expect(mocks.betterAuthPost).toHaveBeenCalledWith(request)
    expect(mocks.writeAudit).not.toHaveBeenCalled()
  })

  test.each([
    ["a successful", Response.json({ user: { id: USER_ID } })],
    ["a failed", Response.json({ error: "Invalid credentials" }, { status: 401 })]
  ])(
    "writes no sign-in audit after %s sign-in, which Better Auth's plugin records",
    async (_, answer) => {
      mocks.betterAuthPost.mockResolvedValueOnce(answer)

      await postToAuthRoute("/sign-in/email", { email: "owner@example.com", password: "x" })

      expect(mocks.writeAudit).not.toHaveBeenCalled()
    }
  )

  test("writes backup code consumed audit after successful verification", async () => {
    await postToAuthRoute("/two-factor/verify-backup-code", { code: "secret" })

    expect(mocks.writeAudit).toHaveBeenCalledWith("auth.backup_code.consumed", userAuditContext)
  })

  test("writes password reset email requested audit with email after success", async () => {
    await postToAuthRoute("/request-password-reset", { email: "owner@example.com" })

    expect(mocks.writeAudit).toHaveBeenCalledWith("auth.password_reset.email_requested", {
      ...requestAuditContext,
      metadata: { email: "owner@example.com" }
    })
  })

  test("writes password changed audit after successful change", async () => {
    await postToAuthRoute("/change-password", {
      currentPassword: "a",
      newPassword: "b"
    })

    expect(mocks.update).toHaveBeenCalledWith({
      id: "users.id",
      mustChangePassword: "users.mustChangePassword"
    })
    expect(mocks.set).toHaveBeenCalledWith({ mustChangePassword: false })
    expect(mocks.eq).toHaveBeenCalledWith("users.id", USER_ID)
    expect(mocks.where).toHaveBeenCalledWith(USER_ID_PREDICATE)
    expect(mocks.writeAudit).toHaveBeenCalledWith("auth.password.changed", userAuditContext)
    expect(mocks.writeAudit).toHaveBeenCalledTimes(1)
  })

  test("does not clear mustChangePassword or audit password change after failed change", async () => {
    mocks.betterAuthPost.mockResolvedValueOnce(
      Response.json({ error: "Invalid password" }, { status: 400 })
    )

    await postToAuthRoute("/change-password", {
      currentPassword: "wrong",
      newPassword: "b"
    })

    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.writeAudit).not.toHaveBeenCalled()
  })

  test.each([
    ["/two-factor/enable", { password: "secret" }],
    ["/two-factor/verify-totp", { code: "123456" }],
    ["/two-factor/generate-backup-codes", { password: "secret" }]
  ])("writes no TOTP audit after a successful %s", async (path, body) => {
    await postToAuthRoute(path, body)

    expect(mocks.writeAudit).not.toHaveBeenCalled()
  })

  test.each(["/sign-in/email", "/sign-up/email"])(
    "writes rate limit audit for %s 429 responses",
    async (path) => {
      mocks.betterAuthPost.mockResolvedValueOnce(
        Response.json({ error: "Too many requests" }, { status: 429 })
      )

      await postToAuthRoute(path, { email: "owner@example.com" })

      expect(mocks.writeAudit).toHaveBeenCalledWith("auth.rate_limit.tripped", {
        ...requestAuditContext,
        metadata: { path: `/api/auth${path}` }
      })
    }
  )

  test.each(["owner", "accountant", "assistant"])(
    "refuses to disable two-factor when the session belongs to an %s",
    async (role) => {
      mocks.getSession.mockResolvedValueOnce({ user: { id: USER_ID, role } })

      const response = await postToAuthRoute("/two-factor/disable", { password: "correct" })

      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({ error: "errors.forbidden" })
      expect(mocks.betterAuthPost).not.toHaveBeenCalled()
    }
  )

  test("refuses to disable two-factor when there is no session", async () => {
    mocks.getSession.mockResolvedValueOnce(null)

    const response = await postToAuthRoute("/two-factor/disable", { password: "correct" })

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: "errors.forbidden" })
    expect(mocks.betterAuthPost).not.toHaveBeenCalled()
  })

  test("audits a windowed refusal with the session user and the suppressed count", async () => {
    mocks.countRateLimitTrip.mockResolvedValueOnce({
      write: true,
      suppressedSincePreviousEntry: 12
    })

    await postToAuthRoute("/two-factor/disable", { password: "correct" })

    expect(mocks.countRateLimitTrip).toHaveBeenCalledWith(
      "auth:two-factor-disable",
      FIFTEEN_MINUTES_MS
    )
    expect(mocks.writeAudit).toHaveBeenCalledTimes(1)
    expect(mocks.writeAudit).toHaveBeenCalledWith("auth.totp.disable_refused", {
      ...userAuditContext,
      metadata: { suppressedSincePreviousEntry: 12 }
    })
  })

  test("audits a refusal without an actor when there is no session", async () => {
    mocks.getSession.mockResolvedValueOnce(null)

    await postToAuthRoute("/two-factor/disable", { password: "correct" })

    expect(mocks.writeAudit).toHaveBeenCalledWith("auth.totp.disable_refused", {
      ...requestAuditContext,
      metadata: { suppressedSincePreviousEntry: 0 }
    })
  })

  test("still refuses and audits without an actor when the session read fails", async () => {
    const sessionError = new Error("database unavailable")

    mocks.getSession.mockRejectedValueOnce(sessionError)

    const response = await postToAuthRoute("/two-factor/disable", { password: "correct" })

    expect(response.status).toBe(403)
    expect(mocks.betterAuthPost).not.toHaveBeenCalled()
    expect(mocks.writeAudit).toHaveBeenCalledWith("auth.totp.disable_refused", {
      ...requestAuditContext,
      metadata: { suppressedSincePreviousEntry: 0 }
    })
    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({ err: sessionError }),
      expect.any(String)
    )
  })

  test("audits once and refuses both when refusals repeat inside a window", async () => {
    mocks.countRateLimitTrip
      .mockResolvedValueOnce({ write: true, suppressedSincePreviousEntry: 0 })
      .mockResolvedValueOnce({ write: false })

    const first = await postToAuthRoute("/two-factor/disable", { password: "correct" })
    const second = await postToAuthRoute("/two-factor/disable", { password: "correct" })

    expect(first.status).toBe(403)
    expect(second.status).toBe(403)
    expect(mocks.writeAudit).toHaveBeenCalledTimes(1)
    expect(mocks.writeAudit).toHaveBeenCalledWith("auth.totp.disable_refused", {
      ...userAuditContext,
      metadata: { suppressedSincePreviousEntry: 0 }
    })
  })

  test("still refuses, without an entry or a session read, when the window suppresses the refusal", async () => {
    mocks.countRateLimitTrip.mockResolvedValueOnce({ write: false })

    const response = await postToAuthRoute("/two-factor/disable", { password: "correct" })

    expect(response.status).toBe(403)
    expect(mocks.writeAudit).not.toHaveBeenCalled()
    expect(mocks.getSession).not.toHaveBeenCalled()
    expect(mocks.betterAuthPost).not.toHaveBeenCalled()
  })

  test("counts refusals under one key when the caller varies the path prefix", async () => {
    await postToAuthRoute("/anything/two-factor/disable")

    expect(mocks.countRateLimitTrip).toHaveBeenCalledWith(
      "auth:two-factor-disable",
      FIFTEEN_MINUTES_MS
    )
  })

  test.each([
    "/two-factor/enable",
    "/two-factor/verify-totp",
    "/two-factor/verify-backup-code",
    "/two-factor/generate-backup-codes"
  ])("still hands %s to Better Auth", async (path) => {
    const response = await postToAuthRoute(path, { code: "123456" })

    expect(response.status).toBe(204)
    expect(mocks.betterAuthPost).toHaveBeenCalledTimes(1)
    expect(mocks.countRateLimitTrip).not.toHaveBeenCalled()
  })
})
