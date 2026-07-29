import { NextRequest } from "next/server"

import { beforeEach, describe, expect, test, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  consume: vi.fn(),
  headers: vi.fn(),
  requestProposalOtp: vi.fn(),
  verifyProposalOtp: vi.fn(),
  writeAudit: vi.fn()
}))

vi.mock("next/headers", () => ({
  headers: mocks.headers
}))

vi.mock("@/lib/i18n/server", () => ({
  t: (key: string) => key
}))

vi.mock("@/lib/audit", () => ({
  writeAudit: mocks.writeAudit
}))

vi.mock("@/lib/rateLimit", () => ({
  rateLimitInstance: { consume: mocks.consume }
}))

vi.mock("@/features/proposals/server", () => ({
  requestProposalOtp: mocks.requestProposalOtp,
  verifyProposalOtp: mocks.verifyProposalOtp
}))

const token = "T".repeat(43)

function createRequest(path: string, body: unknown): NextRequest {
  return new NextRequest(`https://remit.test${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  })
}

function tokenParams() {
  return { params: Promise.resolve({ token }) }
}

beforeEach(() => {
  vi.clearAllMocks()

  mocks.headers.mockResolvedValue(new Headers({ "x-forwarded-for": "203.0.113.7" }))
  mocks.consume.mockResolvedValue({ allowed: true, remaining: 4, resetAt: new Date() })
  mocks.requestProposalOtp.mockResolvedValue({ data: { expiresInMinutes: 10 } })
  mocks.verifyProposalOtp.mockResolvedValue({ data: { status: "accepted" } })
})

describe("POST /p/[token]/otp/request", () => {
  test("passes the token and request metadata through to the feature", async () => {
    const { POST } = await import("../request/route")

    const response = await POST(
      createRequest(`/p/${token}/otp/request`, { action: "accept", email: "client@example.com" }),
      tokenParams()
    )

    expect(response.status).toBe(200)
    expect(mocks.requestProposalOtp).toHaveBeenCalledWith(
      { action: "accept", email: "client@example.com" },
      expect.objectContaining({ token, ipAddress: "203.0.113.7" })
    )
  })

  test("sets the noindex header on a successful response", async () => {
    const { POST } = await import("../request/route")

    const response = await POST(
      createRequest(`/p/${token}/otp/request`, { action: "accept", email: "client@example.com" }),
      tokenParams()
    )

    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow")
  })

  test("sets the noindex header on a rejected response", async () => {
    mocks.requestProposalOtp.mockResolvedValue({ error: "proposals.public.errors.unavailable" })

    const { POST } = await import("../request/route")

    const response = await POST(
      createRequest(`/p/${token}/otp/request`, { action: "accept", email: "client@example.com" }),
      tokenParams()
    )

    expect(response.status).toBe(400)
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow")
  })

  test("returns 429 with the noindex header and audits the trip when rate limited", async () => {
    mocks.consume.mockResolvedValue({ allowed: false, remaining: 0, resetAt: new Date() })

    const { POST } = await import("../request/route")

    const response = await POST(
      createRequest(`/p/${token}/otp/request`, { action: "accept", email: "client@example.com" }),
      tokenParams()
    )

    expect(response.status).toBe(429)
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow")
    expect(mocks.requestProposalOtp).not.toHaveBeenCalled()
    expect(mocks.writeAudit).toHaveBeenCalledWith(
      "auth.rate_limit.tripped",
      expect.objectContaining({ ipAddress: "203.0.113.7" })
    )
  })

  test("keys the rate limit on the caller address and never on the token", async () => {
    const { POST } = await import("../request/route")

    await POST(
      createRequest(`/p/${token}/otp/request`, { action: "accept", email: "client@example.com" }),
      tokenParams()
    )

    const [key, max, windowMs] = mocks.consume.mock.calls[0] ?? []

    expect(key).toBe("proposal.otp.request:203.0.113.7")
    expect(key).not.toContain(token)
    expect(max).toBe(5)
    expect(windowMs).toBe(15 * 60 * 1000)
  })

  test("forwards a malformed body as null rather than throwing", async () => {
    const { POST } = await import("../request/route")

    const request = new NextRequest(`https://remit.test/p/${token}/otp/request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json"
    })

    const response = await POST(request, tokenParams())

    expect(response.status).toBe(200)
    expect(mocks.requestProposalOtp).toHaveBeenCalledWith(null, expect.anything())
  })
})

describe("POST /p/[token]/otp/verify", () => {
  test("returns the resulting status with the noindex header", async () => {
    const { POST } = await import("../verify/route")

    const response = await POST(
      createRequest(`/p/${token}/otp/verify`, {
        action: "accept",
        email: "client@example.com",
        code: "123456",
        rejectionReason: ""
      }),
      tokenParams()
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow")
    await expect(response.json()).resolves.toEqual({ status: "accepted" })
  })

  test("returns 400 with the noindex header when verification is refused", async () => {
    mocks.verifyProposalOtp.mockResolvedValue({ error: "proposals.public.errors.codeInvalid" })

    const { POST } = await import("../verify/route")

    const response = await POST(
      createRequest(`/p/${token}/otp/verify`, {
        action: "accept",
        email: "client@example.com",
        code: "000000",
        rejectionReason: ""
      }),
      tokenParams()
    )

    expect(response.status).toBe(400)
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow")
  })

  test("returns 429 with the noindex header when rate limited", async () => {
    mocks.consume.mockResolvedValue({ allowed: false, remaining: 0, resetAt: new Date() })

    const { POST } = await import("../verify/route")

    const response = await POST(
      createRequest(`/p/${token}/otp/verify`, {
        action: "accept",
        email: "client@example.com",
        code: "123456",
        rejectionReason: ""
      }),
      tokenParams()
    )

    expect(response.status).toBe(429)
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow")
    expect(mocks.verifyProposalOtp).not.toHaveBeenCalled()
  })

  test("allows more verification attempts than code requests in the same window", async () => {
    const { POST } = await import("../verify/route")

    await POST(
      createRequest(`/p/${token}/otp/verify`, {
        action: "accept",
        email: "client@example.com",
        code: "123456",
        rejectionReason: ""
      }),
      tokenParams()
    )

    const [key, max] = mocks.consume.mock.calls[0] ?? []

    expect(key).toBe("proposal.otp.verify:203.0.113.7")
    expect(max).toBe(10)
  })
})
