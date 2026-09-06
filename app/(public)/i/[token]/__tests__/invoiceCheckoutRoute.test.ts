import { NextRequest } from "next/server"

import { beforeEach, describe, expect, test, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  consume: vi.fn(),
  headers: vi.fn(),
  startPublicInvoiceCheckout: vi.fn(),
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

vi.mock("@/features/invoices/server", () => ({
  startPublicInvoiceCheckout: mocks.startPublicInvoiceCheckout
}))

const token = "T".repeat(43)

function createRequest(body?: unknown): NextRequest {
  return new NextRequest(`https://remit.test/i/${token}/pay`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
}

function tokenParams() {
  return { params: Promise.resolve({ token }) }
}

beforeEach(() => {
  vi.clearAllMocks()

  mocks.headers.mockResolvedValue(new Headers({ "x-forwarded-for": "203.0.113.7" }))
  mocks.consume.mockResolvedValue({ allowed: true, remaining: 4, resetAt: new Date() })
  mocks.startPublicInvoiceCheckout.mockResolvedValue({
    data: { url: "https://checkout.stripe.test/c/pay/cs_test" }
  })
})

describe("POST /i/[token]/pay", () => {
  test("returns the checkout url and passes the token and request metadata through", async () => {
    const { POST } = await import("../pay/route")

    const response = await POST(createRequest(), tokenParams())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      url: "https://checkout.stripe.test/c/pay/cs_test"
    })
    expect(mocks.startPublicInvoiceCheckout).toHaveBeenCalledWith({
      token,
      ipAddress: "203.0.113.7",
      userAgent: null
    })
  })

  test("ignores an amount supplied in the request body", async () => {
    const { POST } = await import("../pay/route")

    await POST(
      createRequest({ amountCents: 1, currency: "XXX", invoiceId: "someone-elses" }),
      tokenParams()
    )

    // The feature is handed the token and the request metadata and nothing else, so no field a
    // caller invents can reach the Checkout Session.
    expect(mocks.startPublicInvoiceCheckout).toHaveBeenCalledWith({
      token,
      ipAddress: "203.0.113.7",
      userAgent: null
    })
  })

  test("answers every refusal with one status and the feature's message", async () => {
    const { POST } = await import("../pay/route")

    mocks.startPublicInvoiceCheckout.mockResolvedValue({
      error: "invoices.public.payment.unavailable"
    })

    const response = await POST(createRequest(), tokenParams())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "invoices.public.payment.unavailable"
    })
  })

  test("rejects and audits a caller past the rate limit without starting a checkout", async () => {
    const { POST } = await import("../pay/route")

    mocks.consume.mockResolvedValue({ allowed: false, remaining: 0, resetAt: new Date() })

    const response = await POST(createRequest(), tokenParams())

    expect(response.status).toBe(429)
    expect(mocks.startPublicInvoiceCheckout).not.toHaveBeenCalled()
    expect(mocks.writeAudit).toHaveBeenCalledWith(
      "auth.rate_limit.tripped",
      expect.objectContaining({ metadata: { route: "/i/[token]/pay" } })
    )
  })

  test("keys the rate limit on the caller's address, not on the token", async () => {
    const { POST } = await import("../pay/route")

    await POST(createRequest(), tokenParams())

    expect(mocks.consume).toHaveBeenCalledWith(
      "invoice.checkout.start:203.0.113.7",
      5,
      15 * 60 * 1000
    )
  })

  test("sets the noindex header on every response", async () => {
    const { POST } = await import("../pay/route")

    const response = await POST(createRequest(), tokenParams())

    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow")
  })
})
