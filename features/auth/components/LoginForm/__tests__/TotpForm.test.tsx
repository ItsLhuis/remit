import { useState } from "react"

import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { TotpForm } from "../TotpForm"

const mocks = vi.hoisted(() => ({
  verifyBackupCode: vi.fn(),
  verifyTotp: vi.fn()
}))

vi.mock("@/lib/auth/client", () => ({
  authClient: {
    twoFactor: {
      verifyBackupCode: mocks.verifyBackupCode,
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

const TotpHarness = () => {
  const [verified, setVerified] = useState(false)

  if (verified) return <p>signed in</p>

  return <TotpForm onSuccess={() => setVerified(true)} />
}

describe("TotpForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  test("shows a validation error when the authenticator code is incomplete", async () => {
    const user = userEvent.setup()

    render(<TotpForm onSuccess={vi.fn()} />)

    await user.type(screen.getByLabelText("totp.codeLabel"), "123")
    await user.tab()

    expect(screen.getByRole("alert")).toHaveTextContent("Enter the 6-digit code.")
  })

  test("shows the TOTP error when verification fails", async () => {
    const user = userEvent.setup()

    mocks.verifyTotp.mockResolvedValueOnce({
      error: {
        message: "Code expired"
      }
    })

    render(<TotpForm onSuccess={vi.fn()} />)

    await user.type(screen.getByLabelText("totp.codeLabel"), "123456")

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "totp.verifyCode" })).toBeEnabled()
    })

    await user.click(screen.getByRole("button", { name: "totp.verifyCode" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Code expired")
  })

  test("shows the signed-in state when the authenticator code is accepted", async () => {
    const user = userEvent.setup()

    mocks.verifyTotp.mockResolvedValueOnce({
      error: null
    })

    render(<TotpHarness />)

    await user.type(screen.getByLabelText("totp.codeLabel"), "123456")

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "totp.verifyCode" })).toBeEnabled()
    })

    await user.click(screen.getByRole("button", { name: "totp.verifyCode" }))

    expect(await screen.findByText("signed in")).toBeInTheDocument()
  })

  test("switches to recovery-code verification when the recovery option is selected", async () => {
    const user = userEvent.setup()

    render(<TotpForm onSuccess={vi.fn()} />)

    await user.click(screen.getByRole("button", { name: "totp.useRecoveryCode" }))

    expect(screen.getByText("recoveryCode.description")).toBeInTheDocument()
    expect(screen.getByLabelText("recoveryCode.label")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "recoveryCode.verify" })).toBeDisabled()
  })
})
