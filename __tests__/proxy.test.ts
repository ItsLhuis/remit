import { NextRequest } from "next/server"

import { beforeEach, describe, expect, test, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  consume: vi.fn(),
  getSession: vi.fn(),
  selectResults: [] as unknown[][],
  writeAudit: vi.fn()
}))

vi.mock("@/lib/auth", () => ({
  auth: {
    api: { getSession: mocks.getSession },
    $context: Promise.resolve({
      authCookies: {
        sessionToken: { name: "better-auth.session_token" },
        sessionData: { name: "better-auth.session_data" }
      }
    })
  }
}))

vi.mock("@/lib/audit", () => ({
  writeAudit: mocks.writeAudit
}))

vi.mock("@/lib/rateLimit", () => ({
  rateLimitInstance: { consume: mocks.consume }
}))

// Each proxy stage issues one `select(...).from(...)[.where(...)].limit(1).then(...)`, so one
// thenable that replays a queued row set per call covers the whole chain in call order.
vi.mock("@/database", () => {
  const chain: Record<string, unknown> = {}

  chain.from = () => chain
  chain.where = () => chain
  chain.limit = () => chain
  chain.then = (resolve: (rows: unknown[]) => unknown) =>
    Promise.resolve(resolve(mocks.selectResults.shift() ?? []))

  return { database: { select: () => chain } }
})

vi.mock("@/database/schema", () => ({
  members: {},
  settings: {},
  users: {}
}))

const token = "T".repeat(43)

function createRequest(pathname: string): NextRequest {
  return new NextRequest(`https://remit.test${pathname}`, {
    headers: { "x-forwarded-for": "203.0.113.7" }
  })
}

beforeEach(() => {
  vi.clearAllMocks()

  mocks.selectResults = []
  mocks.consume.mockResolvedValue({ allowed: true, remaining: 59, resetAt: new Date() })
})

describe("proxy on public token routes", () => {
  test.each([`/i/${token}`, `/p/${token}`, `/c/${token}`, `/s/${token}`])(
    "sets the noindex header on %s",
    async (pathname) => {
      const { proxy } = await import("../proxy")

      const response = await proxy(createRequest(pathname))

      expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow")
    }
  )

  test("never reads the session or the database for a public invoice link", async () => {
    const { proxy } = await import("../proxy")

    await proxy(createRequest(`/i/${token}`))

    expect(mocks.getSession).not.toHaveBeenCalled()
  })

  test("rate-limits a public invoice link before it reaches the page", async () => {
    const { proxy } = await import("../proxy")

    await proxy(createRequest(`/i/${token}`))

    expect(mocks.consume).toHaveBeenCalledWith("203.0.113.7", 60, 60000)
  })

  test("refuses a request over the rate limit and keeps the noindex header", async () => {
    mocks.consume.mockResolvedValue({ allowed: false, remaining: 0, resetAt: new Date() })

    const { proxy } = await import("../proxy")

    const response = await proxy(createRequest(`/i/${token}`))

    expect(response.status).toBe(429)
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow")
  })

  test("audits the route template rather than the path, so the token never reaches the log", async () => {
    mocks.consume.mockResolvedValue({ allowed: false, remaining: 0, resetAt: new Date() })

    const { proxy } = await import("../proxy")

    await proxy(createRequest(`/i/${token}`))

    expect(mocks.writeAudit).toHaveBeenCalledWith(
      "auth.rate_limit.tripped",
      expect.objectContaining({ metadata: { route: "/i/[token]" } })
    )
    expect(JSON.stringify(mocks.writeAudit.mock.calls)).not.toContain(token)
  })

  test("lets a webhook delivery reach its route without a session", async () => {
    const { proxy } = await import("../proxy")

    const response = await proxy(createRequest("/api/webhooks/stripe"))

    expect(mocks.getSession).not.toHaveBeenCalled()
    expect(response.headers.get("location")).toBeNull()
  })

  test("lets an anonymous invitee reach the acceptance page instead of the login redirect", async () => {
    const { proxy } = await import("../proxy")

    const response = await proxy(createRequest("/invite/00000000-0000-4000-8000-000000000001"))

    expect(response.headers.get("location")).toBeNull()
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow")
    expect(mocks.getSession).not.toHaveBeenCalled()
  })

  test("keeps the acceptance page unframeable, unlike the anonymous document routes", async () => {
    const { proxy } = await import("../proxy")

    const response = await proxy(createRequest("/invite/00000000-0000-4000-8000-000000000001"))

    expect(response.headers.get("x-frame-options")).toBe("DENY")
  })

  test("rate-limits the acceptance page on its own key", async () => {
    const { proxy } = await import("../proxy")

    await proxy(createRequest("/invite/00000000-0000-4000-8000-000000000001"))

    expect(mocks.consume).toHaveBeenCalledWith("invite:203.0.113.7", 30, 60000)
  })

  test("audits an invitation rate-limit trip without recording the invitation id", async () => {
    mocks.consume.mockResolvedValue({ allowed: false, remaining: 0, resetAt: new Date() })

    const { proxy } = await import("../proxy")

    const response = await proxy(createRequest("/invite/00000000-0000-4000-8000-000000000001"))

    expect(response.status).toBe(429)
    expect(JSON.stringify(mocks.writeAudit.mock.calls)).not.toContain(
      "00000000-0000-4000-8000-000000000001"
    )
  })

  test("allows a public token route to be framed while keeping other routes denied", async () => {
    const { applySecurityHeaders } = await import("../proxy")
    const { NextResponse } = await import("next/server")

    const framed = applySecurityHeaders(NextResponse.next(), true)
    const denied = applySecurityHeaders(NextResponse.next(), false)

    expect(framed.headers.get("x-frame-options")).toBeNull()
    expect(denied.headers.get("x-frame-options")).toBe("DENY")
  })
})

describe("proxy on a session whose membership is gone", () => {
  const activeSession = { user: { id: "user-1", twoFactorEnabled: true } }

  test("bounces a removed member out of the dashboard shell", async () => {
    mocks.getSession.mockResolvedValue(activeSession)
    mocks.selectResults = [[{ id: "user-1" }], [{ businessName: "Acme" }], []]

    const { proxy } = await import("../proxy")

    const response = await proxy(createRequest("/"))

    expect(response.headers.get("location")).toContain("/login")
  })

  test("clears the session cookies, without which the login redirect would loop forever", async () => {
    mocks.getSession.mockResolvedValue(activeSession)
    mocks.selectResults = [[{ id: "user-1" }], [{ businessName: "Acme" }], []]

    const { proxy } = await import("../proxy")

    const response = await proxy(createRequest("/"))
    const setCookie = response.headers.getSetCookie().join(" ")

    expect(setCookie).toContain("better-auth.session_token=;")
    expect(setCookie).toContain("better-auth.session_data=;")
    expect(setCookie).toContain("Expires=Thu, 01 Jan 1970")
  })

  test("lets a member through to the route they asked for", async () => {
    mocks.getSession.mockResolvedValue(activeSession)
    mocks.selectResults = [
      [{ id: "user-1" }],
      [{ businessName: "Acme" }],
      [{ id: "member-1" }],
      [{ mustChangePassword: false }]
    ]

    const { proxy } = await import("../proxy")

    const response = await proxy(createRequest("/"))

    expect(response.headers.get("location")).toBeNull()
  })

  test("never reaches the membership check while setup is unfinished, so a new owner is not bounced", async () => {
    mocks.getSession.mockResolvedValue({ user: { id: "user-1", twoFactorEnabled: false } })
    mocks.selectResults = [[{ id: "user-1" }], [{ businessName: null }]]

    const { proxy } = await import("../proxy")

    const response = await proxy(createRequest("/setup"))

    expect(response.headers.get("location")).toBeNull()
  })
})
