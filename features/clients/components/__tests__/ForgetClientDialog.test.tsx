import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { afterEach, expect, test, vi } from "vitest"

import { TooltipProvider } from "@/components/ui"

import { ForgetClientDialog } from "../ForgetClientDialog"

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
    i18n: {},
    ready: true,
    locales: {}
  })
}))

afterEach(() => {
  cleanup()
})

function renderDialog(blockingContracts: string[], onConfirm = vi.fn()) {
  render(
    <TooltipProvider>
      <ForgetClientDialog
        clientName="Acme Studio"
        blockingContracts={blockingContracts}
        open
        isForgetting={false}
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
      />
    </TooltipProvider>
  )

  return onConfirm
}

test("names the signed contracts that block the erasure before anything is typed", () => {
  renderDialog(["CTR-0001", "CTR-0004"])

  expect(screen.getByText("clients.forget.blockedTitle")).toBeInTheDocument()
  expect(screen.getByText(/CTR-0001, CTR-0004/)).toBeInTheDocument()
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "clients.forget.confirm" })).toBeDisabled()
})

test("confirms once the client's name is typed when nothing blocks the erasure", async () => {
  const user = userEvent.setup()
  const onConfirm = renderDialog([])

  await user.type(screen.getByRole("textbox"), "Acme Studio")
  await user.click(screen.getByRole("button", { name: "clients.forget.confirm" }))

  expect(onConfirm).toHaveBeenCalledWith("Acme Studio")
})
