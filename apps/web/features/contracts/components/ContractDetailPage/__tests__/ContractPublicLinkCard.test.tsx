import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { TooltipProvider } from "@/components/ui"

import { ContractPublicLinkCard } from "../ContractPublicLinkCard"

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  revokeContractPublicLink: vi.fn(),
  rotateContractPublicLink: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn()
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh })
}))

vi.mock("../../../publicLink", () => ({
  revokeContractPublicLink: mocks.revokeContractPublicLink,
  rotateContractPublicLink: mocks.rotateContractPublicLink
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

const contractId = "33333333-3333-4333-8333-333333333333"

function renderCard(props: Parameters<typeof ContractPublicLinkCard>[0]) {
  return render(
    <TooltipProvider>
      <ContractPublicLinkCard {...props} />
    </TooltipProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(cleanup)

test("offers no link controls while the contract is still a draft", () => {
  renderCard({ contractId, publicPath: null, publicLinkState: "unissued" })

  expect(screen.getByText("contracts.detail.publicLinkHidden")).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "contracts.detail.rotateLink" })).toBeNull()
  expect(screen.queryByRole("button", { name: "contracts.detail.revokeLink" })).toBeNull()
})

test("shows the link and both controls once it is live", () => {
  renderCard({ contractId, publicPath: "/c/token-value", publicLinkState: "live" })

  expect(screen.getByRole("textbox")).toHaveValue("/c/token-value")
  expect(screen.getByRole("button", { name: "contracts.detail.rotateLink" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "contracts.detail.revokeLink" })).toBeInTheDocument()
})

test("states a revoked link in words, not colour alone, and offers only a re-issue", () => {
  renderCard({ contractId, publicPath: null, publicLinkState: "revoked" })

  expect(screen.getByText("contracts.detail.publicLinkRevoked")).toBeInTheDocument()
  expect(screen.getByText("contracts.detail.publicLinkRevokedDescription")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "contracts.detail.issueNewLink" })).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "contracts.detail.revokeLink" })).toBeNull()
})

test("warns that the current link breaks before it rotates one", async () => {
  const user = userEvent.setup()

  mocks.rotateContractPublicLink.mockResolvedValue({ data: { id: contractId } })

  renderCard({ contractId, publicPath: "/c/token-value", publicLinkState: "live" })

  await user.click(screen.getByRole("button", { name: "contracts.detail.rotateLink" }))

  expect(screen.getByRole("dialog")).toHaveTextContent("contracts.detail.rotateLinkDescription")

  await user.click(screen.getByRole("button", { name: "contracts.detail.rotateLinkConfirm" }))

  await waitFor(() =>
    expect(mocks.rotateContractPublicLink).toHaveBeenCalledWith({ id: contractId })
  )
  expect(mocks.toastSuccess).toHaveBeenCalledWith("contracts.detail.linkRotated")
})

test("surfaces a refused revocation as an error and leaves the card as it was", async () => {
  const user = userEvent.setup()

  mocks.revokeContractPublicLink.mockResolvedValue({ error: "contracts.errors.publicLinkFailed" })

  renderCard({ contractId, publicPath: "/c/token-value", publicLinkState: "live" })

  await user.click(screen.getByRole("button", { name: "contracts.detail.revokeLink" }))
  await user.click(screen.getByRole("button", { name: "contracts.detail.revokeLinkConfirm" }))

  await waitFor(() =>
    expect(mocks.toastError).toHaveBeenCalledWith("contracts.errors.publicLinkFailed")
  )
  expect(mocks.toastSuccess).not.toHaveBeenCalled()
})
