import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { axe } from "vitest-axe"

import { McpAccessCard } from "../McpAccessCard"

const mocks = vi.hoisted(() => ({
  setMcpEnabled: vi.fn(),
  refresh: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn()
}))

vi.mock("../../../mutations", () => ({
  setMcpEnabled: mocks.setMcpEnabled
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh })
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

  return { ...actual, toast: { error: mocks.toastError, success: mocks.toastSuccess } }
})

beforeEach(() => {
  mocks.setMcpEnabled.mockImplementation(async (input: { enabled: boolean }) => ({
    data: { enabled: input.enabled }
  }))
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

test("has no accessibility violations", async () => {
  const { container } = render(<McpAccessCard enabled={false} />)

  expect((await axe(container)).violations).toEqual([])
})

test("states what turning it on shares before it is on", () => {
  render(<McpAccessCard enabled={false} />)

  expect(screen.getByText("settings.mcp.consentLeaves")).toBeInTheDocument()
  expect(screen.getByText("settings.mcp.consentNever")).toBeInTheDocument()
  expect(screen.getByText("settings.mcp.statusOff")).toBeInTheDocument()
})

test("turns the server on and shows it as on", async () => {
  const user = userEvent.setup()

  render(<McpAccessCard enabled={false} />)

  await user.click(screen.getByRole("button", { name: "settings.mcp.turnOn" }))

  await waitFor(() => expect(screen.getByText("settings.mcp.statusOn")).toBeInTheDocument())
  expect(mocks.setMcpEnabled).toHaveBeenCalledWith({ enabled: true })
  expect(mocks.toastSuccess).toHaveBeenCalledWith("settings.mcp.turnedOn")
  // While the transition is pending the button also carries the spinner's "loading" label, so the
  // control is only named "turn off" alone once the save has settled.
  expect(await screen.findByRole("button", { name: "settings.mcp.turnOff" })).toBeEnabled()
})

test("turns the server off without asking again", async () => {
  const user = userEvent.setup()

  render(<McpAccessCard enabled />)

  await user.click(screen.getByRole("button", { name: "settings.mcp.turnOff" }))

  await waitFor(() => expect(screen.getByText("settings.mcp.statusOff")).toBeInTheDocument())
  expect(mocks.setMcpEnabled).toHaveBeenCalledWith({ enabled: false })
})

test("keeps the server off and says why when the change is refused", async () => {
  const user = userEvent.setup()

  mocks.setMcpEnabled.mockResolvedValue({ error: "The MCP server setting could not be saved" })

  render(<McpAccessCard enabled={false} />)

  await user.click(screen.getByRole("button", { name: "settings.mcp.turnOn" }))

  await waitFor(() =>
    expect(mocks.toastError).toHaveBeenCalledWith("The MCP server setting could not be saved")
  )
  expect(screen.getByText("settings.mcp.statusOff")).toBeInTheDocument()
  expect(mocks.refresh).not.toHaveBeenCalled()
})
