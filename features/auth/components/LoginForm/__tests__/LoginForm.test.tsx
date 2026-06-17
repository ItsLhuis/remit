import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { LoginForm } from "../LoginForm"

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  requestPasswordReset: vi.fn(),
  signInEmail: vi.fn(),
  verifyTotp: vi.fn()
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push
  })
}))

vi.mock("@/lib/auth/client", () => ({
  authClient: {
    requestPasswordReset: mocks.requestPasswordReset,
    signIn: {
      email: mocks.signInEmail
    },
    twoFactor: {
      verifyTotp: mocks.verifyTotp
    }
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

async function fillLogin(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.type(screen.getByLabelText("common.fields.email"), "owner@example.com")
  await user.tab()

  await user.type(screen.getByLabelText("common.fields.password"), "CorrectPassword1!")
  await user.tab()
}

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  test("shows a validation error when the email address is invalid", async () => {
    const user = userEvent.setup()

    render(<LoginForm passwordResetAvailable />)

    await user.type(screen.getByLabelText("common.fields.email"), "not-an-email")
    await user.tab()

    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email address.")
  })

  test("shows the sign-in error when credentials are rejected", async () => {
    const user = userEvent.setup()

    mocks.signInEmail.mockResolvedValueOnce({
      data: null,
      error: {
        message: "Invalid credentials"
      }
    })

    render(<LoginForm passwordResetAvailable />)

    await fillLogin(user)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "auth.login.submit" })).toBeEnabled()
    })

    await user.click(screen.getByRole("button", { name: "auth.login.submit" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid credentials")
  })

  test("moves to setup when sign-in succeeds without two-factor authentication", async () => {
    const user = userEvent.setup()

    mocks.signInEmail.mockResolvedValueOnce({
      data: {},
      error: null
    })

    render(<LoginForm passwordResetAvailable />)

    await fillLogin(user)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "auth.login.submit" })).toBeEnabled()
    })

    await user.click(screen.getByRole("button", { name: "auth.login.submit" }))

    await waitFor(() => {
      expect(mocks.push).toHaveBeenCalledWith("/setup")
    })
  })

  test("moves from password entry to the TOTP step when two-factor authentication is required", async () => {
    const user = userEvent.setup()

    mocks.signInEmail.mockResolvedValueOnce({
      data: {
        twoFactorRedirect: true
      },
      error: null
    })

    render(<LoginForm passwordResetAvailable />)

    await fillLogin(user)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "auth.login.submit" })).toBeEnabled()
    })

    await user.click(screen.getByRole("button", { name: "auth.login.submit" }))

    expect(await screen.findByRole("heading", { name: "totp.title" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "totp.verifyCode" })).toBeDisabled()
  })
})
