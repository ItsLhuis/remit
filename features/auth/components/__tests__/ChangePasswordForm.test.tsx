import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { ChangePasswordForm } from "../ChangePasswordForm"

const mocks = vi.hoisted(() => ({
  changePassword: vi.fn(),
  toastSuccess: vi.fn()
}))

vi.mock("@/lib/auth/client", () => ({
  authClient: {
    changePassword: mocks.changePassword
  }
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
    toast: {
      success: mocks.toastSuccess
    }
  }
})

async function fillValidPasswords(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.type(
    screen.getByLabelText("settings.security.changePassword.currentPassword"),
    "CurrentPassword1!"
  )
  await user.tab()

  await user.type(
    screen.getByLabelText("settings.security.changePassword.newPassword"),
    "NewPassword1!"
  )
  await user.tab()

  await user.type(
    screen.getByLabelText("settings.security.changePassword.confirmPassword"),
    "NewPassword1!"
  )
  await user.tab()
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

test("shows a validation error when confirmation does not match in settings", async () => {
  const user = userEvent.setup()

  render(<ChangePasswordForm variant="settings" />)

  await user.type(
    screen.getByLabelText("settings.security.changePassword.currentPassword"),
    "CurrentPassword1!"
  )
  await user.tab()

  await user.type(
    screen.getByLabelText("settings.security.changePassword.newPassword"),
    "NewPassword1!"
  )
  await user.tab()

  await user.type(
    screen.getByLabelText("settings.security.changePassword.confirmPassword"),
    "DifferentPassword1!"
  )
  await user.tab()

  expect(screen.getByRole("alert")).toHaveTextContent("Passwords do not match.")
})

test("shows the Better Auth error when the current password is wrong in settings", async () => {
  const user = userEvent.setup()

  mocks.changePassword.mockResolvedValueOnce({
    error: {
      message: "Current password is incorrect"
    }
  })

  render(<ChangePasswordForm variant="settings" />)

  await fillValidPasswords(user)

  await waitFor(() => {
    expect(
      screen.getByRole("button", { name: "settings.security.changePassword.submit" })
    ).toBeEnabled()
  })

  await user.click(screen.getByRole("button", { name: "settings.security.changePassword.submit" }))

  expect(await screen.findByRole("alert")).toHaveTextContent("Current password is incorrect")
})

test("resets the form and shows a success toast after a successful settings password change", async () => {
  const user = userEvent.setup()

  mocks.changePassword.mockResolvedValueOnce({
    error: null
  })

  render(<ChangePasswordForm variant="settings" />)

  await fillValidPasswords(user)

  await waitFor(() => {
    expect(
      screen.getByRole("button", { name: "settings.security.changePassword.submit" })
    ).toBeEnabled()
  })

  await user.click(screen.getByRole("button", { name: "settings.security.changePassword.submit" }))

  await waitFor(() => {
    expect(mocks.changePassword).toHaveBeenCalledWith({
      currentPassword: "CurrentPassword1!",
      newPassword: "NewPassword1!",
      revokeOtherSessions: true
    })
  })

  await waitFor(() => {
    expect(mocks.toastSuccess).toHaveBeenCalledWith("settings.security.changePassword.changed", {
      description: "settings.security.changePassword.changedDescription"
    })
  })

  expect(screen.getByLabelText("settings.security.changePassword.currentPassword")).toHaveValue("")
  expect(screen.getByLabelText("settings.security.changePassword.newPassword")).toHaveValue("")
  expect(screen.getByLabelText("settings.security.changePassword.confirmPassword")).toHaveValue("")
})
