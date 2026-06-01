import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { RegisterForm } from "../RegisterForm"

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  signUpEmail: vi.fn()
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push
  })
}))

vi.mock("@/lib/auth/client", () => ({
  authClient: {
    signUp: {
      email: mocks.signUpEmail
    }
  }
}))

vi.mock("@/features/setup", () => ({
  ONBOARDING_STEPS: {
    account: 1
  },
  ONBOARDING_TOTAL_STEPS: 4
}))

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {},
    ready: true,
    locales: {}
  })
}))

async function fillRegistration(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.type(screen.getByLabelText("common.fields.name"), "Ada Lovelace")
  await user.tab()

  await user.type(screen.getByLabelText("common.fields.email"), "ada@example.com")
  await user.tab()

  await user.type(screen.getByLabelText("common.fields.password"), "StrongPassword1!")
  await user.tab()

  await user.type(screen.getByLabelText("auth.register.confirmPassword"), "StrongPassword1!")
  await user.tab()
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

test("shows a validation error when registration passwords do not match", async () => {
  const user = userEvent.setup()

  render(<RegisterForm />)

  await user.type(screen.getByLabelText("common.fields.name"), "Ada Lovelace")
  await user.tab()

  await user.type(screen.getByLabelText("common.fields.email"), "ada@example.com")
  await user.tab()

  await user.type(screen.getByLabelText("common.fields.password"), "StrongPassword1!")
  await user.tab()

  await user.type(screen.getByLabelText("auth.register.confirmPassword"), "DifferentPassword1!")
  await user.tab()

  expect(screen.getByRole("alert")).toHaveTextContent("Passwords do not match.")
})

test("shows the sign-up error when registration fails", async () => {
  const user = userEvent.setup()

  mocks.signUpEmail.mockResolvedValueOnce({
    error: {
      message: "Email is already registered"
    }
  })

  render(<RegisterForm />)

  await fillRegistration(user)

  await waitFor(() => {
    expect(screen.getByRole("button", { name: "auth.register.submit" })).toBeEnabled()
  })

  await user.click(screen.getByRole("button", { name: "auth.register.submit" }))

  expect(await screen.findByRole("alert")).toHaveTextContent("Email is already registered")
})

test("moves to setup after registration succeeds", async () => {
  const user = userEvent.setup()

  mocks.signUpEmail.mockResolvedValueOnce({
    error: null
  })

  render(<RegisterForm />)

  await fillRegistration(user)

  await waitFor(() => {
    expect(screen.getByRole("button", { name: "auth.register.submit" })).toBeEnabled()
  })

  await user.click(screen.getByRole("button", { name: "auth.register.submit" }))

  await waitFor(() => {
    expect(mocks.push).toHaveBeenCalledWith("/setup")
  })
})
