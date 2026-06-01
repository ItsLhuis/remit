import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { TooltipProvider } from "@/components/ui"

import { SetupForm } from "../SetupForm"

type CountrySelectProps = {
  disabled?: boolean
  id?: string
  onChangeAction?: (country: { alpha2: string }) => void
  valid?: boolean
  value?: string
}

type CurrencySelectProps = {
  disabled?: boolean
  id?: string
  onValueChangeAction?: (value: string) => void
  valid?: boolean
  value?: string
}

const mocks = vi.hoisted(() => ({
  saveBusinessProfile: vi.fn(),
  twoFactorEnable: vi.fn(),
  verifyTotp: vi.fn()
}))

vi.mock("../../mutations", () => ({
  saveBusinessProfile: mocks.saveBusinessProfile
}))

vi.mock("@/lib/auth/client", () => ({
  authClient: {
    twoFactor: {
      enable: mocks.twoFactorEnable,
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
    CountrySelect: ({ disabled, id, onChangeAction, valid = true, value }: CountrySelectProps) => (
      <select
        id={id}
        value={value ?? ""}
        disabled={disabled}
        aria-invalid={!valid}
        onChange={(event) => onChangeAction?.({ alpha2: event.target.value })}
      >
        <option value="">Select country</option>
        <option value="US">United States</option>
      </select>
    ),
    CurrencySelect: ({
      disabled,
      id,
      onValueChangeAction,
      valid = true,
      value
    }: CurrencySelectProps) => (
      <select
        id={id}
        value={value ?? ""}
        disabled={disabled}
        aria-invalid={!valid}
        onChange={(event) => onValueChangeAction?.(event.target.value)}
      >
        <option value="">Select currency</option>
        <option value="USD">USD</option>
      </select>
    )
  }
})

async function completeBusinessStep(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.type(screen.getByLabelText("setup.businessProfile.businessName"), "Acme Studio")
  await user.tab()

  await user.type(
    screen.getByLabelText("setup.businessProfile.businessEmail"),
    "billing@example.com"
  )
  await user.tab()

  await user.type(screen.getByLabelText("setup.businessProfile.businessTaxId"), "VAT123")
  await user.tab()

  await user.selectOptions(screen.getByLabelText("common.fields.country"), "US")
  await user.selectOptions(screen.getByLabelText("setup.businessProfile.defaultCurrency"), "USD")

  await waitFor(() => {
    expect(screen.getByRole("button", { name: "common.actions.continue" })).toBeEnabled()
  })

  await user.click(screen.getByRole("button", { name: "common.actions.continue" }))
}

async function completeTotpStep(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.type(screen.getByLabelText("common.fields.password"), "CorrectPassword1!")

  await waitFor(() => {
    expect(screen.getByRole("button", { name: "setup.totp.setupAuthenticator" })).toBeEnabled()
  })

  await user.click(screen.getByRole("button", { name: "setup.totp.setupAuthenticator" }))

  expect(await screen.findByRole("heading", { name: "totp.scanQr" })).toBeInTheDocument()

  await user.type(screen.getByLabelText("totp.codeLabel"), "123456")

  await waitFor(() => {
    expect(screen.getByRole("button", { name: "totp.verifyCode" })).toBeEnabled()
  })

  await user.click(screen.getByRole("button", { name: "totp.verifyCode" }))
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.saveBusinessProfile.mockResolvedValue({ data: { success: true } })
  mocks.twoFactorEnable.mockResolvedValue({
    data: {
      backupCodes: ["alpha-code", "bravo-code"],
      totpURI: "otpauth://totp/Remit?secret=ABC123"
    },
    error: null
  })
  mocks.verifyTotp.mockResolvedValue({ error: null })
})

afterEach(() => {
  cleanup()
})

test("advances from business profile through recovery codes when setup is completed", async () => {
  const user = userEvent.setup()

  render(
    <TooltipProvider>
      <SetupForm initialStep="business" />
    </TooltipProvider>
  )

  await completeBusinessStep(user)

  expect(await screen.findByRole("heading", { name: "totp.title" })).toBeInTheDocument()

  await completeTotpStep(user)

  expect(await screen.findByRole("heading", { name: "backupCodes.title" })).toBeInTheDocument()
  expect(screen.getByText("alpha-code")).toBeInTheDocument()

  await user.click(screen.getByRole("checkbox", { name: "backupCodes.confirm" }))
  await user.click(screen.getByRole("button", { name: "common.actions.continue" }))

  expect(await screen.findByRole("heading", { name: "setup.done.title" })).toBeInTheDocument()
})

test("starts on the TOTP branch when the business profile is already complete", () => {
  render(
    <TooltipProvider>
      <SetupForm initialStep="totp" />
    </TooltipProvider>
  )

  expect(screen.getByRole("heading", { name: "totp.title" })).toBeInTheDocument()
  expect(screen.queryByLabelText("setup.businessProfile.businessName")).not.toBeInTheDocument()
})
