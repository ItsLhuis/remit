import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { afterEach, expect, test, vi } from "vitest"

import { axe } from "vitest-axe"

import { TooltipProvider } from "@/components/ui"

import { CreateWebhookDialog } from "../CreateWebhookDialog"

const mocks = vi.hoisted(() => ({
  createWebhookEndpoint: vi.fn()
}))

vi.mock("../../../mutations", () => ({
  createWebhookEndpoint: mocks.createWebhookEndpoint
}))

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {},
    ready: true,
    locales: {}
  })
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

test("has no accessibility violations while the form is open", async () => {
  render(
    <TooltipProvider>
      <CreateWebhookDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} />
    </TooltipProvider>
  )

  // Scoped to the dialog rather than the body: an open Radix modal marks its siblings aria-hidden
  // and adds focus-guard spans outside itself, which axe reports against nodes this form never
  // renders.
  expect((await axe(screen.getByRole("dialog"))).violations).toEqual([])
})

test("shows the server's refusal of an address beside the submit area", async () => {
  const user = userEvent.setup()

  mocks.createWebhookEndpoint.mockResolvedValue({
    error: "Webhooks cannot be sent to a private or reserved address"
  })

  render(
    <TooltipProvider>
      <CreateWebhookDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} />
    </TooltipProvider>
  )

  await user.type(screen.getByLabelText("settings.webhooks.urlLabel"), "https://192.168.1.10/hook")
  await user.click(screen.getByRole("checkbox", { name: "settings.webhooks.events.invoice.paid" }))
  await user.click(screen.getByRole("button", { name: "settings.webhooks.submitCreate" }))

  expect(
    await screen.findByText("Webhooks cannot be sent to a private or reserved address")
  ).toBeInTheDocument()
})
