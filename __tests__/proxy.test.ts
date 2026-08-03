import { NextRequest } from "next/server"

import { beforeEach, describe, expect, test, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  consume: vi.fn(),
  getSession: vi.fn(),
  writeAudit: vi.fn()
}))

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mocks.getSession } }
}))

vi.mock("@/lib/audit", () => ({
  writeAudit: mocks.writeAudit
}))

vi.mock("@/lib/rateLimit", () => ({
  rateLimitInstance: { consume: mocks.consume }
}))

vi.mock("@/database", () => ({
  database: { select: vi.fn() }
}))

vi.mock("@/database/schema", () => ({
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

  test("allows a public token route to be framed while keeping other routes denied", async () => {
    const { applySecurityHeaders } = await import("../proxy")
    const { NextResponse } = await import("next/server")

    const framed = applySecurityHeaders(NextResponse.next(), true)
    const denied = applySecurityHeaders(NextResponse.next(), false)

    expect(framed.headers.get("x-frame-options")).toBeNull()
    expect(denied.headers.get("x-frame-options")).toBe("DENY")
  })
})
