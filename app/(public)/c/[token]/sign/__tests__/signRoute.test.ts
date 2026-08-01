import { NextRequest } from "next/server"

import { beforeEach, describe, expect, test, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  consume: vi.fn(),
  headers: vi.fn(),
  signPublicContract: vi.fn(),
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

vi.mock("@/features/contracts/server", () => ({
  signPublicContract: mocks.signPublicContract
}))

const token = "T".repeat(43)

const signBody = {
  signerName: "Ada Lovelace",
  signerEmail: "ada@northwind.test",
  consentAccepted: true
}

function createRequest(body: unknown): NextRequest {
  return new NextRequest(`https://remit.test/c/${token}/sign`, {
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

  mocks.headers.mockResolvedValue(
    new Headers({ "x-forwarded-for": "203.0.113.7", "user-agent": "signing-browser" })
  )
  mocks.consume.mockResolvedValue({ allowed: true, remaining: 4, resetAt: new Date() })
  mocks.signPublicContract.mockResolvedValue({
    data: { status: "signed", signedAt: new Date("2026-08-01T10:00:00.000Z") }
  })
})

describe("POST /c/[token]/sign", () => {
  test("passes the token and request metadata through to the feature", async () => {
    const { POST } = await import("../route")

    const response = await POST(createRequest(signBody), tokenParams())

    expect(response.status).toBe(200)
    expect(mocks.signPublicContract).toHaveBeenCalledWith(signBody, {
      token,
      ipAddress: "203.0.113.7",
      userAgent: "signing-browser"
    })
  })

  test("returns the signed status to the caller", async () => {
    const { POST } = await import("../route")

    const response = await POST(createRequest(signBody), tokenParams())

    await expect(response.json()).resolves.toEqual(expect.objectContaining({ status: "signed" }))
  })

  test("sets the noindex header on a successful response", async () => {
    const { POST } = await import("../route")

    const response = await POST(createRequest(signBody), tokenParams())

    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow")
  })

  test("sets the noindex header on a rejected signature", async () => {
    mocks.signPublicContract.mockResolvedValue({ error: "contracts.public.errors.unavailable" })

    const { POST } = await import("../route")

    const response = await POST(createRequest(signBody), tokenParams())

    expect(response.status).toBe(400)
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow")
  })

  test("answers every failure with the same status, whatever the reason", async () => {
    const { POST } = await import("../route")

    mocks.signPublicContract.mockResolvedValueOnce({
      error: "contracts.public.errors.unavailable"
    })
    const unavailable = await POST(createRequest(signBody), tokenParams())

    mocks.signPublicContract.mockResolvedValueOnce({
      error: "contracts.public.errors.alreadySigned"
    })
    const alreadySigned = await POST(createRequest(signBody), tokenParams())

    expect(unavailable.status).toBe(alreadySigned.status)
  })

  test("declares its own rate limit rather than relying on the proxy budget", async () => {
    const { POST } = await import("../route")

    await POST(createRequest(signBody), tokenParams())

    expect(mocks.consume).toHaveBeenCalledWith("contract.sign:203.0.113.7", 5, 15 * 60 * 1000)
  })

  test("refuses and audits a request over the rate limit without reaching the feature", async () => {
    mocks.consume.mockResolvedValue({ allowed: false, remaining: 0, resetAt: new Date() })

    const { POST } = await import("../route")

    const response = await POST(createRequest(signBody), tokenParams())

    expect(response.status).toBe(429)
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow")
    expect(mocks.signPublicContract).not.toHaveBeenCalled()
    expect(mocks.writeAudit).toHaveBeenCalledWith(
      "auth.rate_limit.tripped",
      expect.objectContaining({ metadata: { route: "/c/[token]/sign" } })
    )
  })

  test("never echoes the token in the rate-limit audit entry", async () => {
    mocks.consume.mockResolvedValue({ allowed: false, remaining: 0, resetAt: new Date() })

    const { POST } = await import("../route")

    await POST(createRequest(signBody), tokenParams())

    expect(JSON.stringify(mocks.writeAudit.mock.calls)).not.toContain(token)
  })

  test("hands a malformed body to the feature as null rather than throwing", async () => {
    mocks.signPublicContract.mockResolvedValue({ error: "contracts.public.errors.requestFailed" })

    const { POST } = await import("../route")

    const request = new NextRequest(`https://remit.test/c/${token}/sign`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json"
    })

    const response = await POST(request, tokenParams())

    expect(response.status).toBe(400)
    expect(mocks.signPublicContract).toHaveBeenCalledWith(null, expect.objectContaining({ token }))
  })
})
