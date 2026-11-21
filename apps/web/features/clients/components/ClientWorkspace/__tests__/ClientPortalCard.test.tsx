import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { TooltipProvider } from "@/components/ui"

import { ClientPortalCard } from "../ClientPortalCard"

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  revokeClientPortalLink: vi.fn(),
  rotateClientPortalLink: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn()
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh })
}))

vi.mock("../../../mutations", () => ({
  revokeClientPortalLink: mocks.revokeClientPortalLink,
  rotateClientPortalLink: mocks.rotateClientPortalLink
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

const clientId = "44444444-4444-4444-8444-444444444444"

function renderCard(portalPath: string | null) {
  return render(
    <TooltipProvider>
      <ClientPortalCard clientId={clientId} portalPath={portalPath} />
    </TooltipProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(cleanup)

test("says the portal is off in words and offers only to enable it", () => {
  renderCard(null)

  expect(screen.getByText("clients.portal.offBadge")).toBeInTheDocument()
  expect(screen.getByText("clients.portal.offDescription")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "clients.portal.enable" })).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "clients.portal.disable" })).toBeNull()
})

test("shows the portal link and both controls once one is live", () => {
  renderCard("/s/portal-token")

  expect(screen.getByRole("textbox")).toHaveValue("/s/portal-token")
  expect(screen.getByRole("button", { name: "clients.portal.rotate" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "clients.portal.disable" })).toBeInTheDocument()
})

test("mints a portal on confirmation and reports it as enabled", async () => {
  const user = userEvent.setup()

  mocks.rotateClientPortalLink.mockResolvedValue({ data: { id: clientId } })

  renderCard(null)

  await user.click(screen.getByRole("button", { name: "clients.portal.enable" }))

  const dialog = screen.getByRole("dialog")

  expect(dialog).toHaveTextContent("clients.portal.enableDescription")

  await user.click(within(dialog).getByRole("button", { name: "clients.portal.enable" }))

  await waitFor(() => expect(mocks.rotateClientPortalLink).toHaveBeenCalledWith({ id: clientId }))
  expect(mocks.toastSuccess).toHaveBeenCalledWith("clients.portal.enabled")
})

test("warns that the client loses access before disabling a portal", async () => {
  const user = userEvent.setup()

  mocks.revokeClientPortalLink.mockResolvedValue({ data: { id: clientId } })

  renderCard("/s/portal-token")

  await user.click(screen.getByRole("button", { name: "clients.portal.disable" }))

  const dialog = screen.getByRole("dialog")

  expect(dialog).toHaveTextContent("clients.portal.disableDescription")

  await user.click(within(dialog).getByRole("button", { name: "clients.portal.disable" }))

  await waitFor(() => expect(mocks.revokeClientPortalLink).toHaveBeenCalledWith({ id: clientId }))
  expect(mocks.toastSuccess).toHaveBeenCalledWith("clients.portal.disabled")
})
