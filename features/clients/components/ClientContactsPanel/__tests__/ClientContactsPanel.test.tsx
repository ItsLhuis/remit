import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { NuqsTestingAdapter } from "nuqs/adapters/testing"

import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { TooltipProvider } from "@/components/ui"

import { type ClientContact } from "../../../types"
import { ClientContactsPanel } from "../ClientContactsPanel"

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  setPrimaryClientContact: vi.fn(),
  softDeleteClientContact: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn()
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh })
}))

vi.mock("../../../mutations", () => ({
  createClientContact: vi.fn(),
  setPrimaryClientContact: mocks.setPrimaryClientContact,
  softDeleteClientContact: mocks.softDeleteClientContact,
  updateClientContact: vi.fn()
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

function makeContact(overrides: Partial<ClientContact> = {}): ClientContact {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    clientId: "22222222-2222-4222-8222-222222222222",
    name: "Jordan Ellis",
    email: "jordan@acme.test",
    phone: "",
    role: "",
    isPrimary: false,
    createdAt: new Date("2026-08-01T10:00:00.000Z"),
    ...overrides
  }
}

function renderPanel(contacts: ClientContact[]) {
  render(
    <NuqsTestingAdapter>
      <TooltipProvider>
        <ClientContactsPanel
          clientId="22222222-2222-4222-8222-222222222222"
          clientEmail="billing@acme.test"
          contacts={contacts}
        />
      </TooltipProvider>
    </NuqsTestingAdapter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()

  mocks.setPrimaryClientContact.mockResolvedValue({ data: { id: "ok" } })
})

afterEach(() => {
  cleanup()
})

test("teaches what contacts are for when the client has none", () => {
  renderPanel([])

  expect(screen.getByText("clients.contacts.emptyTitle")).toBeInTheDocument()
  expect(screen.getByText("clients.contacts.noPrimaryNote")).toBeInTheDocument()
})

// The primary contact must be distinguishable without colour: the badge carries a text label beside
// its icon, and the header states the address documents are actually sent to.
test("names the primary contact in text and states where documents go", () => {
  renderPanel([
    makeContact({ name: "Sam Reyes", email: "finance@acme.test", isPrimary: true }),
    makeContact({ id: "33333333-3333-4333-8333-333333333333" })
  ])

  expect(screen.getByText("clients.contacts.primaryBadge")).toBeInTheDocument()
  expect(screen.getByText("clients.contacts.recipientNote")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "finance@acme.test" })).toBeInTheDocument()
})

test("promotes a contact and refreshes the workspace", async () => {
  const user = userEvent.setup()

  renderPanel([
    makeContact({ name: "Sam Reyes", isPrimary: true }),
    makeContact({ id: "44444444-4444-4444-8444-444444444444" })
  ])

  const [, secondActions] = screen.getAllByRole("button", {
    name: "clients.contacts.actionsLabel"
  })

  if (!secondActions) throw new Error("Contact actions button was not rendered")

  await user.click(secondActions)
  await user.click(await screen.findByText("clients.contacts.makePrimary"))

  await waitFor(() => {
    expect(mocks.setPrimaryClientContact).toHaveBeenCalledWith({
      id: "44444444-4444-4444-8444-444444444444"
    })
  })

  expect(mocks.refresh).toHaveBeenCalled()
  expect(mocks.toastSuccess).toHaveBeenCalledWith("clients.contacts.promoted")
})

test("surfaces a failed promotion as an error toast", async () => {
  const user = userEvent.setup()

  mocks.setPrimaryClientContact.mockResolvedValue({
    error: "clients.errors.contactPrimaryConflict"
  })

  renderPanel([makeContact()])

  await user.click(screen.getByRole("button", { name: "clients.contacts.actionsLabel" }))
  await user.click(await screen.findByText("clients.contacts.makePrimary"))

  await waitFor(() => {
    expect(mocks.toastError).toHaveBeenCalledWith("clients.errors.contactPrimaryConflict")
  })

  expect(mocks.refresh).not.toHaveBeenCalled()
})
