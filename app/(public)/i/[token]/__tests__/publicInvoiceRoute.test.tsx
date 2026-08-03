import { beforeEach, describe, expect, test, vi } from "vitest"

// The feature barrel is stubbed rather than loaded: `InvoiceDetailPage` reaches the `"use server"`
// mutations module, which Vitest evaluates for real and which boots `lib/config/env`. The two
// components are compared by identity, so stand-ins are all this file needs from them.
const mocks = vi.hoisted(() => ({
  getPublicInvoice: vi.fn(),
  recordPublicInvoiceView: vi.fn(),
  PublicInvoicePage: () => null,
  PublicInvoiceUnavailable: () => null
}))

vi.mock("@/lib/i18n/server", () => ({
  t: (key: string) => key
}))

vi.mock("@/features/invoices", () => ({
  PublicInvoicePage: mocks.PublicInvoicePage,
  PublicInvoiceUnavailable: mocks.PublicInvoiceUnavailable
}))

vi.mock("@/features/invoices/server", () => ({
  getPublicInvoice: mocks.getPublicInvoice,
  recordPublicInvoiceView: mocks.recordPublicInvoiceView
}))

const token = "T".repeat(43)

function tokenParams() {
  return { params: Promise.resolve({ token }) }
}

beforeEach(() => {
  vi.clearAllMocks()

  mocks.getPublicInvoice.mockResolvedValue({ number: "INV-0001" })
  mocks.recordPublicInvoiceView.mockResolvedValue(undefined)
})

describe("/i/[token]", () => {
  test("declares itself unindexable in the page head", async () => {
    const { metadata } = await import("../page")

    expect(metadata.robots).toEqual({ index: false, follow: false })
  })

  test("keeps the invoice number out of the browser tab title", async () => {
    const { metadata } = await import("../page")

    expect(metadata.title).toBe("invoices.public.metadataTitle")
  })

  test("renders the invoice for the holder of a resolvable token", async () => {
    const PublicInvoiceRoute = (await import("../page")).default

    const element = await PublicInvoiceRoute(tokenParams())

    expect(element.type).toBe(mocks.PublicInvoicePage)
  })

  test("renders the unavailable panel when the token resolves to nothing", async () => {
    mocks.getPublicInvoice.mockResolvedValue(null)

    const PublicInvoiceRoute = (await import("../page")).default

    const element = await PublicInvoiceRoute(tokenParams())

    expect(element.type).toBe(mocks.PublicInvoiceUnavailable)
  })

  test("records a view once the token resolves", async () => {
    const PublicInvoiceRoute = (await import("../page")).default

    await PublicInvoiceRoute(tokenParams())

    expect(mocks.recordPublicInvoiceView).toHaveBeenCalledWith({ token })
  })

  test("records nothing for a token that resolves to nothing", async () => {
    mocks.getPublicInvoice.mockResolvedValue(null)

    const PublicInvoiceRoute = (await import("../page")).default

    await PublicInvoiceRoute(tokenParams())

    expect(mocks.recordPublicInvoiceView).not.toHaveBeenCalled()
  })

  test("never hands the token to the rendered page", async () => {
    const PublicInvoiceRoute = (await import("../page")).default

    const element = await PublicInvoiceRoute(tokenParams())

    expect(JSON.stringify(element.props)).not.toContain(token)
  })
})
