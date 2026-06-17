import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { ResetPasswordForm } from "../ResetPasswordForm"

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  resetPassword: vi.fn()
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push
  })
}))

vi.mock("@/lib/auth/client", () => ({
  authClient: {
    resetPassword: mocks.resetPassword
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

async function fillResetPasswords(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.type(screen.getByLabelText("auth.resetPassword.newPassword"), "NewPassword1!")
  await user.tab()

  await user.type(screen.getByLabelText("auth.resetPassword.confirmPassword"), "NewPassword1!")
  await user.tab()
}

describe("ResetPasswordForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  test("shows an invalid-link message when the reset token is missing", () => {
    render(<ResetPasswordForm token={null} />)

    expect(screen.getByRole("heading", { name: "auth.resetPassword.title" })).toBeInTheDocument()
    expect(screen.getByText("auth.resetPassword.invalidDescription")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "auth.resetPassword.backToLogin" })).toHaveAttribute(
      "href",
      "/login"
    )
  })

  test("shows a validation error when reset passwords do not match", async () => {
    const user = userEvent.setup()

    render(<ResetPasswordForm token="reset-token" />)

    await user.type(screen.getByLabelText("auth.resetPassword.newPassword"), "NewPassword1!")
    await user.tab()

    await user.type(screen.getByLabelText("auth.resetPassword.confirmPassword"), "Different1!")
    await user.tab()

    expect(screen.getByRole("alert")).toHaveTextContent("Passwords do not match.")
  })

  test("shows the reset error when the token is rejected", async () => {
    const user = userEvent.setup()

    mocks.resetPassword.mockResolvedValueOnce({
      error: {
        message: "Reset token expired"
      }
    })

    render(<ResetPasswordForm token="reset-token" />)

    await fillResetPasswords(user)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "auth.resetPassword.submit" })).toBeEnabled()
    })

    await user.click(screen.getByRole("button", { name: "auth.resetPassword.submit" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Reset token expired")
  })

  test("moves to login after the password is reset", async () => {
    const user = userEvent.setup()

    mocks.resetPassword.mockResolvedValueOnce({
      error: null
    })

    render(<ResetPasswordForm token="reset-token" />)

    await fillResetPasswords(user)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "auth.resetPassword.submit" })).toBeEnabled()
    })

    await user.click(screen.getByRole("button", { name: "auth.resetPassword.submit" }))

    await waitFor(() => {
      expect(mocks.push).toHaveBeenCalledWith("/login")
    })
  })
})
