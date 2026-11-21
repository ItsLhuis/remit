import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { TooltipProvider } from "@/components/ui"

import { ProposalPublicLinkCard } from "../ProposalPublicLinkCard"

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  revokeProposalPublicLink: vi.fn(),
  rotateProposalPublicLink: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn()
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh })
}))

vi.mock("../../../publicLink", () => ({
  revokeProposalPublicLink: mocks.revokeProposalPublicLink,
  rotateProposalPublicLink: mocks.rotateProposalPublicLink
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

const proposalId = "33333333-3333-4333-8333-333333333333"

function renderCard(props: Parameters<typeof ProposalPublicLinkCard>[0]) {
  return render(
    <TooltipProvider>
      <ProposalPublicLinkCard {...props} />
    </TooltipProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(cleanup)

test("offers no link controls while the proposal is still a draft", () => {
  renderCard({ proposalId, publicPath: null, publicLinkState: "unissued" })

  expect(screen.getByText("proposals.detail.publicLinkHidden")).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "proposals.detail.rotateLink" })).toBeNull()
  expect(screen.queryByRole("button", { name: "proposals.detail.revokeLink" })).toBeNull()
})

test("shows the link and both controls once it is live", () => {
  renderCard({ proposalId, publicPath: "/p/token-value", publicLinkState: "live" })

  expect(screen.getByRole("textbox")).toHaveValue("/p/token-value")
  expect(screen.getByRole("button", { name: "proposals.detail.rotateLink" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "proposals.detail.revokeLink" })).toBeInTheDocument()
})

test("states a revoked link in words, not colour alone, and offers only a re-issue", () => {
  renderCard({ proposalId, publicPath: null, publicLinkState: "revoked" })

  expect(screen.getByText("proposals.detail.publicLinkRevoked")).toBeInTheDocument()
  expect(screen.getByText("proposals.detail.publicLinkRevokedDescription")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "proposals.detail.issueNewLink" })).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "proposals.detail.revokeLink" })).toBeNull()
})

test("warns that the current link breaks before it rotates one", async () => {
  const user = userEvent.setup()

  mocks.rotateProposalPublicLink.mockResolvedValue({ data: { id: proposalId } })

  renderCard({ proposalId, publicPath: "/p/token-value", publicLinkState: "live" })

  await user.click(screen.getByRole("button", { name: "proposals.detail.rotateLink" }))

  expect(screen.getByRole("dialog")).toHaveTextContent("proposals.detail.rotateLinkDescription")

  await user.click(screen.getByRole("button", { name: "proposals.detail.rotateLinkConfirm" }))

  await waitFor(() =>
    expect(mocks.rotateProposalPublicLink).toHaveBeenCalledWith({ id: proposalId })
  )
  expect(mocks.toastSuccess).toHaveBeenCalledWith("proposals.detail.linkRotated")
})

test("surfaces a refused revocation as an error and leaves the card as it was", async () => {
  const user = userEvent.setup()

  mocks.revokeProposalPublicLink.mockResolvedValue({ error: "proposals.errors.publicLinkFailed" })

  renderCard({ proposalId, publicPath: "/p/token-value", publicLinkState: "live" })

  await user.click(screen.getByRole("button", { name: "proposals.detail.revokeLink" }))
  await user.click(screen.getByRole("button", { name: "proposals.detail.revokeLinkConfirm" }))

  await waitFor(() =>
    expect(mocks.toastError).toHaveBeenCalledWith("proposals.errors.publicLinkFailed")
  )
  expect(mocks.toastSuccess).not.toHaveBeenCalled()
})
