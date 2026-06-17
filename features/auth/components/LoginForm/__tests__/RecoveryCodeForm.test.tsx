import { useState } from "react"

import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { RecoveryCodeForm } from "../RecoveryCodeForm"

const mocks = vi.hoisted(() => ({
  verifyBackupCode: vi.fn()
}))

vi.mock("@/lib/auth/client", () => ({
  authClient: {
    twoFactor: {
      verifyBackupCode: mocks.verifyBackupCode
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

const RecoveryCodeHarness = () => {
  const [verified, setVerified] = useState(false)

  if (verified) return <p>signed in with recovery code</p>

  return <RecoveryCodeForm onSuccess={() => setVerified(true)} />
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

test("shows a validation error when the recovery code format is invalid", async () => {
  const user = userEvent.setup()

  render(<RecoveryCodeForm onSuccess={vi.fn()} />)

  await user.type(screen.getByLabelText("recoveryCode.label"), "invalid!!")
  await user.tab()

  expect(screen.getByRole("alert")).toHaveTextContent("Invalid recovery code format.")
})

test("shows the recovery-code error when verification fails", async () => {
  const user = userEvent.setup()

  mocks.verifyBackupCode.mockResolvedValueOnce({
    error: {
      message: "Recovery code was already used"
    }
  })

  render(<RecoveryCodeForm onSuccess={vi.fn()} />)

  await user.type(screen.getByLabelText("recoveryCode.label"), "abcde-12345")

  await waitFor(() => {
    expect(screen.getByRole("button", { name: "recoveryCode.verify" })).toBeEnabled()
  })

  await user.click(screen.getByRole("button", { name: "recoveryCode.verify" }))

  expect(await screen.findByRole("alert")).toHaveTextContent("Recovery code was already used")
})

test("shows the signed-in state when the recovery code is accepted", async () => {
  const user = userEvent.setup()

  mocks.verifyBackupCode.mockResolvedValueOnce({
    error: null
  })

  render(<RecoveryCodeHarness />)

  await user.type(screen.getByLabelText("recoveryCode.label"), "abcde-12345")

  await waitFor(() => {
    expect(screen.getByRole("button", { name: "recoveryCode.verify" })).toBeEnabled()
  })

  await user.click(screen.getByRole("button", { name: "recoveryCode.verify" }))

  expect(await screen.findByText("signed in with recovery code")).toBeInTheDocument()
})
