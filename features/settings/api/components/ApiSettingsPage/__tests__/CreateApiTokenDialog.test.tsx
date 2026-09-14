import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { axe } from "vitest-axe"

import { TooltipProvider } from "@/components/ui"

import { CreateApiTokenDialog } from "../CreateApiTokenDialog"

const mocks = vi.hoisted(() => ({
  createApiToken: vi.fn(),
  toastSuccess: vi.fn()
}))

vi.mock("../../../mutations", () => ({
  createApiToken: mocks.createApiToken
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

  return { ...actual, toast: { error: vi.fn(), success: mocks.toastSuccess } }
})

const secret = "remit_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcdefg"

beforeEach(() => {
  mocks.createApiToken.mockResolvedValue({
    data: {
      secret,
      token: {
        id: "8f7c3c8e-2d6a-4f1e-9b5a-1c2d3e4f5a6b",
        name: "Accounting export",
        tokenPrefix: "remit_AbCdEf",
        scopes: ["invoices:read"],
        status: "active",
        createdAt: new Date(),
        lastUsedAt: null,
        expiresAt: null
      }
    }
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

test("has no accessibility violations while the form is open", async () => {
  render(
    <TooltipProvider>
      <CreateApiTokenDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} />
    </TooltipProvider>
  )

  // Scoped to the dialog rather than the body: an open Radix modal marks its siblings aria-hidden
  // and adds focus-guard spans outside itself, which axe reports against nodes this form never
  // renders.
  expect((await axe(screen.getByRole("dialog"))).violations).toEqual([])
})

test("keeps the submit disabled until the token has a name and at least one scope", async () => {
  const user = userEvent.setup()

  render(
    <TooltipProvider>
      <CreateApiTokenDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} />
    </TooltipProvider>
  )

  await user.type(screen.getByLabelText("settings.api.nameLabel"), "Accounting export")

  expect(screen.getByRole("button", { name: "settings.api.submitCreate" })).toBeDisabled()

  await user.click(screen.getByRole("checkbox", { name: "settings.api.scopes.invoices" }))

  await waitFor(() =>
    expect(screen.getByRole("button", { name: "settings.api.submitCreate" })).toBeEnabled()
  )
})

test("reveals the created token once and forgets it when the dialog closes", async () => {
  const user = userEvent.setup()
  const onCreated = vi.fn()

  const { rerender } = render(
    <TooltipProvider>
      <CreateApiTokenDialog open onOpenChange={vi.fn()} onCreated={onCreated} />
    </TooltipProvider>
  )

  await user.type(screen.getByLabelText("settings.api.nameLabel"), "Accounting export")
  await user.click(screen.getByRole("checkbox", { name: "settings.api.scopes.invoices" }))
  await user.click(screen.getByRole("button", { name: "settings.api.submitCreate" }))

  expect(await screen.findByDisplayValue(secret)).toBeInTheDocument()
  expect(screen.getByText("settings.api.revealWarningTitle")).toBeInTheDocument()
  expect(onCreated).toHaveBeenCalledTimes(1)

  await user.click(screen.getByRole("button", { name: "common.actions.done" }))

  rerender(
    <TooltipProvider>
      <CreateApiTokenDialog open={false} onOpenChange={vi.fn()} onCreated={onCreated} />
    </TooltipProvider>
  )
  rerender(
    <TooltipProvider>
      <CreateApiTokenDialog open onOpenChange={vi.fn()} onCreated={onCreated} />
    </TooltipProvider>
  )

  expect(screen.queryByDisplayValue(secret)).not.toBeInTheDocument()
})
