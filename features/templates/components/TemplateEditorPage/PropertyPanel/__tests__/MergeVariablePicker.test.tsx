// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { afterEach, beforeAll, expect, test, vi } from "vitest"

import { MergeVariablePicker } from "../MergeVariablePicker"

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {},
    ready: true,
    locales: {}
  })
}))

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn()

  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
})

afterEach(() => {
  cleanup()
})

test("shows human-readable labels and never a raw token", async () => {
  const user = userEvent.setup()

  render(<MergeVariablePicker type="invoice" onInsert={vi.fn()} />)

  await user.click(screen.getByRole("button", { name: "templates.mergeVariables.insertVariable" }))

  expect(screen.getByText("templates.mergeVariables.labels.clientName")).toBeInTheDocument()
  expect(document.body.textContent).not.toContain("{{")
  expect(document.body.textContent).not.toContain("client.name")
})

test("hands the underlying identifier to the caller on selection", async () => {
  const user = userEvent.setup()
  const onInsert = vi.fn()

  render(<MergeVariablePicker type="invoice" onInsert={onInsert} />)

  await user.click(screen.getByRole("button", { name: "templates.mergeVariables.insertVariable" }))
  await user.click(screen.getByText("templates.mergeVariables.labels.invoiceTotal"))

  expect(onInsert).toHaveBeenCalledWith("invoice.total")
})
