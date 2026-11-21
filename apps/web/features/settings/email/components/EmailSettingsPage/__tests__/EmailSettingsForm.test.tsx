import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { type EmailSettingsValues } from "../../../schemas"
import { EmailSettingsForm } from "../EmailSettingsForm"

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  saveEmailSettings: vi.fn(),
  sendEmailSettingsTest: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn()
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mocks.refresh
  })
}))

vi.mock("../../../mutations", () => ({
  saveEmailSettings: mocks.saveEmailSettings,
  sendEmailSettingsTest: mocks.sendEmailSettingsTest
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
      error: mocks.toastError,
      success: mocks.toastSuccess
    }
  }
})

const validSmtpSettings: EmailSettingsValues = {
  emailProvider: "smtp",
  smtpHost: "smtp.example.com",
  smtpPort: 587,
  smtpUser: "mailer@example.com",
  smtpPass: "",
  smtpPassConfigured: true,
  smtpSecure: false,
  resendApiKey: "",
  resendApiKeyConfigured: false,
  emailFromName: "Acme Studio",
  emailFromAddress: "billing@example.com"
}

const validResendSettings: EmailSettingsValues = {
  ...validSmtpSettings,
  emailProvider: "resend",
  smtpHost: "",
  smtpUser: "",
  smtpPassConfigured: false,
  resendApiKey: "",
  resendApiKeyConfigured: true
}

function renderEmailSettingsForm(initialValues: EmailSettingsValues = validSmtpSettings): void {
  render(
    <EmailSettingsForm
      initialValues={initialValues}
      defaultTestRecipient="owner@example.com"
      initialEmailTestSendAt={null}
    />
  )
}

describe("EmailSettingsForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  test("shows SMTP required-field errors when SMTP values are cleared", async () => {
    const user = userEvent.setup()

    renderEmailSettingsForm({
      ...validSmtpSettings,
      smtpPassConfigured: false,
      smtpPass: "smtp-secret"
    })

    await user.clear(screen.getByLabelText("settings.email.smtpHost"))
    await user.clear(screen.getByLabelText("settings.email.smtpUser"))
    await user.clear(screen.getByLabelText("settings.email.smtpPassword"))

    expect(await screen.findByText("SMTP host is required.")).toBeInTheDocument()
    expect(screen.getByText("SMTP username is required.")).toBeInTheDocument()
    expect(screen.getByText("SMTP password is required.")).toBeInTheDocument()
  })

  test("keeps a configured SMTP password hidden and submits an empty value when unchanged", async () => {
    const user = userEvent.setup()

    mocks.saveEmailSettings.mockResolvedValueOnce({
      data: {
        settings: {
          ...validSmtpSettings,
          emailFromName: "Updated Studio",
          emailTestSendAt: null
        }
      }
    })

    renderEmailSettingsForm({
      ...validSmtpSettings,
      smtpPass: "stored-sentinel"
    })

    const smtpPassword = screen.getByLabelText("settings.email.smtpPassword")

    expect(smtpPassword).toBeDisabled()
    expect(smtpPassword).toHaveValue("")
    expect(smtpPassword).toHaveAttribute("placeholder", "settings.email.configuredPlaceholder")
    expect(screen.queryByDisplayValue("stored-sentinel")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "settings.email.changeSecret" }))

    expect(smtpPassword).toBeEnabled()
    expect(smtpPassword).toHaveValue("")
    expect(smtpPassword).toHaveAttribute("placeholder", "settings.email.smtpPasswordPlaceholder")

    await user.type(smtpPassword, "updated")
    await user.click(screen.getByRole("button", { name: "common.actions.cancel" }))

    expect(smtpPassword).toBeDisabled()
    expect(smtpPassword).toHaveValue("")
    expect(smtpPassword).toHaveAttribute("placeholder", "settings.email.configuredPlaceholder")
    expect(screen.queryByDisplayValue("updated")).not.toBeInTheDocument()

    await user.clear(screen.getByLabelText("settings.email.fromName"))
    await user.type(screen.getByLabelText("settings.email.fromName"), "Updated Studio")

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "settings.email.save" })).toBeEnabled()
    })

    await user.click(screen.getByRole("button", { name: "settings.email.save" }))

    await waitFor(() => {
      expect(mocks.saveEmailSettings).toHaveBeenCalledWith(
        expect.objectContaining({ smtpPass: "" })
      )
    })
    expect(mocks.saveEmailSettings).not.toHaveBeenCalledWith(
      expect.objectContaining({ smtpPass: "stored-sentinel" })
    )
    expect(mocks.saveEmailSettings).not.toHaveBeenCalledWith(
      expect.objectContaining({ smtpPass: "updated" })
    )
  })

  test("shows Resend required-field errors when Resend is selected without an API key", async () => {
    const user = userEvent.setup()

    renderEmailSettingsForm({
      ...validSmtpSettings,
      resendApiKeyConfigured: false
    })

    await user.click(screen.getByRole("radio", { name: /settings.email.providerResend/ }))

    expect(screen.queryByLabelText("settings.email.smtpHost")).not.toBeInTheDocument()
    await user.type(screen.getByLabelText("settings.email.resendApiKey"), "temporary")
    await user.clear(screen.getByLabelText("settings.email.resendApiKey"))

    expect(await screen.findByText("Resend API key is required.")).toBeInTheDocument()
  })

  test("shows the last test timestamp when a test email is sent successfully", async () => {
    const user = userEvent.setup()

    mocks.sendEmailSettingsTest.mockResolvedValueOnce({
      data: {
        emailTestSendAt: "2026-05-30T12:00:00.000Z"
      }
    })

    renderEmailSettingsForm()

    await user.click(screen.getByRole("button", { name: "settings.email.sendTest" }))

    expect(await screen.findByText("settings.email.lastTestSend")).toBeInTheDocument()

    await waitFor(() => {
      expect(mocks.toastSuccess).toHaveBeenCalledWith("settings.email.testSent")
    })
  })

  test("shows the provider error when a test email fails", async () => {
    const user = userEvent.setup()

    mocks.sendEmailSettingsTest.mockResolvedValueOnce({
      error: "SMTP authentication failed"
    })

    renderEmailSettingsForm()

    await user.click(screen.getByRole("button", { name: "settings.email.sendTest" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("SMTP authentication failed")

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith("SMTP authentication failed")
    })
  })

  test("shows the saved transition when email settings are submitted successfully", async () => {
    const user = userEvent.setup()

    mocks.saveEmailSettings.mockResolvedValueOnce({
      data: {
        settings: {
          ...validSmtpSettings,
          emailFromName: "Updated Studio",
          emailTestSendAt: null
        }
      }
    })

    renderEmailSettingsForm()

    await user.clear(screen.getByLabelText("settings.email.fromName"))
    await user.type(screen.getByLabelText("settings.email.fromName"), "Updated Studio")

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "settings.email.save" })).toBeEnabled()
    })

    await user.click(screen.getByRole("button", { name: "settings.email.save" }))

    await waitFor(() => {
      expect(mocks.toastSuccess).toHaveBeenCalledWith("settings.email.saved")
    })
  })

  test("shows the server error when email settings cannot be saved", async () => {
    const user = userEvent.setup()

    mocks.saveEmailSettings.mockResolvedValueOnce({
      error: "Failed to update email settings"
    })

    renderEmailSettingsForm(validResendSettings)

    await user.clear(screen.getByLabelText("settings.email.fromName"))
    await user.type(screen.getByLabelText("settings.email.fromName"), "Updated Studio")

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "settings.email.save" })).toBeEnabled()
    })

    await user.click(screen.getByRole("button", { name: "settings.email.save" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to update email settings")
  })
})
