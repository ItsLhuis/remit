import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { TooltipProvider } from "@/components/ui"

import { TotpReconfigureDialog } from "../TotpReconfigureDialog"

const mocks = vi.hoisted(() => ({
  generateBackupCodes: vi.fn(),
  toastSuccess: vi.fn(),
  twoFactorEnable: vi.fn(),
  verifyTotp: vi.fn()
}))

vi.mock("@/lib/auth/client", () => ({
  authClient: {
    twoFactor: {
      enable: mocks.twoFactorEnable,
      generateBackupCodes: mocks.generateBackupCodes,
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

vi.mock("@/components/ui", async () => {
  const actual = await vi.importActual<typeof import("@/components/ui")>("@/components/ui")

  return {
    ...actual,
    toast: {
      success: mocks.toastSuccess
    }
  }
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.twoFactorEnable.mockResolvedValue({
    data: {
      totpURI: "otpauth://totp/Remit?secret=ABC123"
    },
    error: null
  })
  mocks.generateBackupCodes.mockResolvedValue({
    data: {
      backupCodes: ["alpha-code", "bravo-code"]
    },
    error: null
  })
})

afterEach(() => {
  cleanup()
})

async function openScanStep(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole("button", { name: "settings.security.reconfigure" }))

  expect(
    await screen.findByRole("heading", { name: "settings.security.dialog.confirmTitle" })
  ).toBeInTheDocument()

  await user.type(
    screen.getByLabelText("settings.security.dialog.confirmPassword"),
    "CorrectPassword1!"
  )

  await waitFor(() => {
    expect(screen.getByRole("button", { name: "common.actions.continue" })).toBeEnabled()
  })

  await user.click(screen.getByRole("button", { name: "common.actions.continue" }))

  expect(await screen.findByRole("heading", { name: "totp.scanQr" })).toBeInTheDocument()
  expect(screen.getByText("ABC123")).toBeInTheDocument()
}

test("shows an invalid-code error while staying on the scan step", async () => {
  const user = userEvent.setup()

  mocks.verifyTotp.mockResolvedValueOnce({
    error: {
      message: "Code expired"
    }
  })

  render(
    <TooltipProvider>
      <TotpReconfigureDialog />
    </TooltipProvider>
  )

  await openScanStep(user)

  await user.type(screen.getByLabelText("totp.codeLabel"), "123456")

  await waitFor(() => {
    expect(screen.getByRole("button", { name: "totp.verifyCode" })).toBeEnabled()
  })

  await user.click(screen.getByRole("button", { name: "totp.verifyCode" }))

  expect(await screen.findByRole("alert")).toHaveTextContent("Code expired")
  expect(screen.getByRole("heading", { name: "totp.scanQr" })).toBeInTheDocument()
})

test("progresses from password confirmation through scan and recovery codes when reconfiguration succeeds", async () => {
  const user = userEvent.setup()

  mocks.verifyTotp.mockResolvedValueOnce({
    error: null
  })

  render(
    <TooltipProvider>
      <TotpReconfigureDialog />
    </TooltipProvider>
  )

  await openScanStep(user)

  await user.type(screen.getByLabelText("totp.codeLabel"), "123456")

  await waitFor(() => {
    expect(screen.getByRole("button", { name: "totp.verifyCode" })).toBeEnabled()
  })

  await user.click(screen.getByRole("button", { name: "totp.verifyCode" }))

  expect(await screen.findByRole("heading", { name: "backupCodes.title" })).toBeInTheDocument()
  expect(screen.getByText("alpha-code")).toBeInTheDocument()

  await user.click(screen.getByRole("checkbox", { name: "backupCodes.confirm" }))
  await user.click(screen.getByRole("button", { name: "common.actions.done" }))

  await waitFor(() => {
    expect(mocks.toastSuccess).toHaveBeenCalledWith("settings.security.reconfigured", {
      description: "settings.security.reconfiguredDescription"
    })
  })
})
