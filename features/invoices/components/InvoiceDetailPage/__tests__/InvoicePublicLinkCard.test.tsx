import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { TooltipProvider } from "@/components/ui"

import { InvoicePublicLinkCard } from "../InvoicePublicLinkCard"

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  revokeInvoicePublicLink: vi.fn(),
  rotateInvoicePublicLink: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn()
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh })
}))

vi.mock("../../../publicLink", () => ({
  revokeInvoicePublicLink: mocks.revokeInvoicePublicLink,
  rotateInvoicePublicLink: mocks.rotateInvoicePublicLink
}))

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {},
    ready: true,
    locales: {}
  })
}))

vi.mock("@/components/ui", async () => {
  const actual = await vi.importActual<typeof import("@/components/ui")>("@/components/ui")

  return {
    ...actual,
    toast: { error: mocks.toastError, success: mocks.toastSuccess }
  }
})

const invoiceId = "33333333-3333-4333-8333-333333333333"

function renderCard(props: Parameters<typeof InvoicePublicLinkCard>[0]) {
  return render(
    <TooltipProvider>
      <InvoicePublicLinkCard {...props} />
    </TooltipProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(cleanup)

test("offers no link controls while the invoice is still a draft", () => {
  renderCard({ invoiceId, publicPath: null, publicLinkState: "unissued" })

  expect(screen.getByText("invoices.detail.publicLinkHidden")).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "invoices.detail.rotateLink" })).toBeNull()
  expect(screen.queryByRole("button", { name: "invoices.detail.revokeLink" })).toBeNull()
})

test("shows the link and both controls once it is live", () => {
  renderCard({ invoiceId, publicPath: "/i/token-value", publicLinkState: "live" })

  expect(screen.getByRole("textbox")).toHaveValue("/i/token-value")
  expect(screen.getByRole("button", { name: "invoices.detail.rotateLink" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "invoices.detail.revokeLink" })).toBeInTheDocument()
})

test("states a revoked link in words, not colour alone, and offers only a re-issue", () => {
  renderCard({ invoiceId, publicPath: null, publicLinkState: "revoked" })

  expect(screen.getByText("invoices.detail.publicLinkRevoked")).toBeInTheDocument()
  expect(screen.getByText("invoices.detail.publicLinkRevokedDescription")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "invoices.detail.issueNewLink" })).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "invoices.detail.revokeLink" })).toBeNull()
})

test("warns that the current link breaks before it rotates one", async () => {
  const user = userEvent.setup()

  mocks.rotateInvoicePublicLink.mockResolvedValue({ data: { id: invoiceId } })

  renderCard({ invoiceId, publicPath: "/i/token-value", publicLinkState: "live" })

  await user.click(screen.getByRole("button", { name: "invoices.detail.rotateLink" }))

  expect(screen.getByRole("dialog")).toHaveTextContent("invoices.detail.rotateLinkDescription")

  await user.click(screen.getByRole("button", { name: "invoices.detail.rotateLinkConfirm" }))

  await waitFor(() => expect(mocks.rotateInvoicePublicLink).toHaveBeenCalledWith({ id: invoiceId }))
  expect(mocks.toastSuccess).toHaveBeenCalledWith("invoices.detail.linkRotated")
})

test("surfaces a refused revocation as an error and leaves the card as it was", async () => {
  const user = userEvent.setup()

  mocks.revokeInvoicePublicLink.mockResolvedValue({ error: "invoices.errors.publicLinkFailed" })

  renderCard({ invoiceId, publicPath: "/i/token-value", publicLinkState: "live" })

  await user.click(screen.getByRole("button", { name: "invoices.detail.revokeLink" }))
  await user.click(screen.getByRole("button", { name: "invoices.detail.revokeLinkConfirm" }))

  await waitFor(() =>
    expect(mocks.toastError).toHaveBeenCalledWith("invoices.errors.publicLinkFailed")
  )
  expect(mocks.toastSuccess).not.toHaveBeenCalled()
})
