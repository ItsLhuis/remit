import { NextRequest } from "next/server"

import { beforeEach, describe, expect, test, vi } from "vitest"

const USER_ID = "00000000-0000-0000-0000-000000000001"
const REQUEST_IP = "203.0.113.1"
const REQUEST_USER_AGENT = "vitest"
const USER_ID_PREDICATE = "user id predicate"

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
  getSession: vi.fn(),
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
  writeAudit: mocks.writeAudit
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

async function importRoute(): Promise<typeof import("./route")> {
  return await import("./route")
}

async function postToAuthRoute(path: string, body?: Record<string, unknown>): Promise<Response> {
  const route = await importRoute()

  return await route.POST(createRequest(path, body))
}

describe("auth route audit wrapper", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.betterAuthPost.mockResolvedValue(new Response(null, { status: 204 }))
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

  test("writes successful login audit with actor user id", async () => {
    mocks.betterAuthPost.mockResolvedValueOnce(Response.json({ user: { id: USER_ID } }))

    await postToAuthRoute("/sign-in/email", { email: "owner@example.com", password: "x" })

    expect(mocks.writeAudit).toHaveBeenCalledWith("auth.login.succeeded", {
      ...requestAuditContext,
      actorUserId: USER_ID
    })
  })

  test("writes failed login audit with email but without password metadata", async () => {
    mocks.betterAuthPost.mockResolvedValueOnce(
      Response.json({ error: "Invalid credentials" }, { status: 401 })
    )

    await postToAuthRoute("/sign-in/email", {
      email: "owner@example.com",
      password: "secret"
    })

    expect(mocks.writeAudit).toHaveBeenCalledWith("auth.login.failed", {
      ...requestAuditContext,
      metadata: { email: "owner@example.com" }
    })
  })

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
  ])("writes TOTP reconfigured audit after %s", async (path, body) => {
    await postToAuthRoute(path, body)

    expect(mocks.writeAudit).toHaveBeenCalledWith("auth.totp.reconfigured", userAuditContext)
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
})
