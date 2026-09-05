import { beforeEach, describe, expect, test, vi } from "vitest"

// The feature barrel is stubbed rather than loaded: `PublicClientPortalPage` sits beside components
// that reach the `"use server"` mutations module, which Vitest evaluates for real and which boots
// `lib/config/env`. The two components are compared by identity, so stand-ins are all this file
// needs from them.
const mocks = vi.hoisted(() => ({
  consume: vi.fn(),
  getClientPortal: vi.fn(),
  writeAudit: vi.fn(),
  PublicClientPortalPage: () => null,
  PublicClientPortalUnavailable: () => null
}))

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers({ "x-forwarded-for": "203.0.113.7" }))
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

vi.mock("@/features/clients", () => ({
  PublicClientPortalPage: mocks.PublicClientPortalPage,
  PublicClientPortalUnavailable: mocks.PublicClientPortalUnavailable
}))

vi.mock("@/features/clients/server", () => ({
  getClientPortal: mocks.getClientPortal
}))

const token = "T".repeat(43)

function tokenParams() {
  return { params: Promise.resolve({ token }) }
}

beforeEach(() => {
  vi.clearAllMocks()

  mocks.consume.mockResolvedValue({ allowed: true })
  mocks.getClientPortal.mockResolvedValue({ clientName: "Northwind Ltd" })
  mocks.writeAudit.mockResolvedValue(undefined)
})

describe("/s/[token]", () => {
  test("declares itself unindexable in the page head", async () => {
    const { metadata } = await import("../page")

    expect(metadata.robots).toEqual({ index: false, follow: false })
  })

  test("keeps the client's name out of the browser tab title", async () => {
    const { metadata } = await import("../page")

    expect(metadata.title).toBe("clients.public.metadataTitle")
  })

  test("renders the portal for the holder of a resolvable token", async () => {
    const PublicClientPortalRoute = (await import("../page")).default

    const element = await PublicClientPortalRoute(tokenParams())

    expect(element.type).toBe(mocks.PublicClientPortalPage)
  })

  test("renders the unavailable panel when the token resolves to nothing", async () => {
    mocks.getClientPortal.mockResolvedValue(null)

    const PublicClientPortalRoute = (await import("../page")).default

    const element = await PublicClientPortalRoute(tokenParams())

    expect(element.type).toBe(mocks.PublicClientPortalUnavailable)
  })

  test("rate limits on the caller's address rather than on the token", async () => {
    const PublicClientPortalRoute = (await import("../page")).default

    await PublicClientPortalRoute(tokenParams())

    expect(mocks.consume).toHaveBeenCalledWith("client.portal:203.0.113.7", 30, 300000)
  })

  test("answers a throttled caller exactly as it answers a bad token, and reads nothing", async () => {
    mocks.consume.mockResolvedValue({ allowed: false })

    const PublicClientPortalRoute = (await import("../page")).default

    const element = await PublicClientPortalRoute(tokenParams())

    expect(element.type).toBe(mocks.PublicClientPortalUnavailable)
    expect(mocks.getClientPortal).not.toHaveBeenCalled()
  })

  test("records a tripped limit without recording the token", async () => {
    mocks.consume.mockResolvedValue({ allowed: false })

    const PublicClientPortalRoute = (await import("../page")).default

    await PublicClientPortalRoute(tokenParams())

    expect(mocks.writeAudit).toHaveBeenCalledWith("auth.rate_limit.tripped", {
      ipAddress: "203.0.113.7",
      userAgent: null,
      metadata: { route: "/s/[token]" }
    })
    expect(JSON.stringify(mocks.writeAudit.mock.calls)).not.toContain(token)
  })

  test("never hands the token to the rendered page", async () => {
    const PublicClientPortalRoute = (await import("../page")).default

    const element = await PublicClientPortalRoute(tokenParams())

    expect(JSON.stringify(element.props)).not.toContain(token)
  })
})
