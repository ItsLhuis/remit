import { afterEach, expect, test, vi } from "vitest"

import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { TooltipProvider } from "@/components/ui"

import { DeleteClientDialog } from "../DeleteClientDialog"

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
})

test("calls confirm when the delete action is approved", async () => {
  const user = userEvent.setup()
  const onConfirm = vi.fn()

  render(
    <TooltipProvider>
      <DeleteClientDialog
        clientName="Acme Studio"
        open
        isDeleting={false}
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
      />
    </TooltipProvider>
  )

  await user.click(screen.getByRole("button", { name: "clients.delete.confirm" }))

  expect(onConfirm).toHaveBeenCalledOnce()
})
