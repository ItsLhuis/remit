import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { PaymentSettingsForm } from "../PaymentSettingsForm"
import { type PaymentSettingsValues } from "../../../schemas"

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  savePaymentSettings: vi.fn(),
  testStripeConnection: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn()
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mocks.refresh
  })
}))

vi.mock("../../../mutations", () => ({
  savePaymentSettings: mocks.savePaymentSettings,
  testStripeConnection: mocks.testStripeConnection
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

const basePaymentSettings: PaymentSettingsValues = {
  paymentBankName: "",
  paymentIban: "",
  paymentIbanConfigured: false,
  paymentInstructions: "",
  stripePublishableKey: "",
  stripeSecretKey: "",
  stripeSecretKeyConfigured: false,
  stripeWebhookSecret: "",
  stripeWebhookSecretConfigured: false
}

const configuredStripeSettings: PaymentSettingsValues = {
  ...basePaymentSettings,
  stripePublishableKey: "pk_test_existing",
  stripeSecretKeyConfigured: true,
  stripeWebhookSecretConfigured: true
}

function renderPaymentSettingsForm(
  initialValues: PaymentSettingsValues = basePaymentSettings
): void {
  render(<PaymentSettingsForm initialValues={initialValues} initialStripeTestConnectionAt={null} />)
}

describe("PaymentSettingsForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  test("shows a Stripe secret-key error when only the publishable key is provided", async () => {
    const user = userEvent.setup()

    renderPaymentSettingsForm()

    await user.type(screen.getByLabelText("settings.payment.stripePublishableKey"), "pk_test_123")

    expect(await screen.findByText("Stripe secret key is required.")).toBeInTheDocument()
  })

  test("keeps configured payment secrets hidden and submits empty values when unchanged", async () => {
    const user = userEvent.setup()

    mocks.savePaymentSettings.mockResolvedValueOnce({
      data: {
        settings: {
          ...configuredStripeSettings,
          paymentBankName: "Acme Bank",
          paymentIbanConfigured: true,
          stripeTestConnectionAt: null
        }
      }
    })

    renderPaymentSettingsForm({
      ...configuredStripeSettings,
      paymentIban: "iban-sentinel",
      paymentIbanConfigured: true,
      stripeSecretKey: "stripe-secret-sentinel",
      stripeWebhookSecret: "webhook-secret-sentinel"
    })

    const paymentIban = screen.getByLabelText("settings.payment.iban")
    const stripeSecretKey = screen.getByLabelText("settings.payment.stripeSecretKey")
    const stripeWebhookSecret = screen.getByLabelText("settings.payment.stripeWebhookSecret")

    expect(paymentIban).toBeDisabled()
    expect(paymentIban).toHaveValue("")
    expect(paymentIban).toHaveAttribute("placeholder", "settings.payment.configuredPlaceholder")
    expect(stripeSecretKey).toBeDisabled()
    expect(stripeSecretKey).toHaveValue("")
    expect(stripeWebhookSecret).toBeDisabled()
    expect(stripeWebhookSecret).toHaveValue("")
    expect(screen.queryByDisplayValue("iban-sentinel")).not.toBeInTheDocument()
    expect(screen.queryByDisplayValue("stripe-secret-sentinel")).not.toBeInTheDocument()
    expect(screen.queryByDisplayValue("webhook-secret-sentinel")).not.toBeInTheDocument()

    const changePaymentIbanButton = screen.getAllByRole("button", {
      name: "settings.payment.changeSecret"
    })[0]

    if (!changePaymentIbanButton) {
      throw new Error("Expected a payment IBAN change button")
    }

    await user.click(changePaymentIbanButton)

    expect(paymentIban).toBeEnabled()
    expect(paymentIban).toHaveValue("")
    expect(paymentIban).toHaveAttribute("placeholder", "settings.payment.ibanPlaceholder")

    await user.type(paymentIban, "updated")
    await user.click(screen.getByRole("button", { name: "common.actions.cancel" }))

    expect(paymentIban).toBeDisabled()
    expect(paymentIban).toHaveValue("")
    expect(paymentIban).toHaveAttribute("placeholder", "settings.payment.configuredPlaceholder")
    expect(screen.queryByDisplayValue("updated")).not.toBeInTheDocument()

    await user.type(screen.getByLabelText("settings.payment.bankName"), "Acme Bank")

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "settings.payment.save" })).toBeEnabled()
    })

    await user.click(screen.getByRole("button", { name: "settings.payment.save" }))

    await waitFor(() => {
      expect(mocks.savePaymentSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentIban: "",
          stripeSecretKey: "",
          stripeWebhookSecret: ""
        })
      )
    })
    expect(mocks.savePaymentSettings).not.toHaveBeenCalledWith(
      expect.objectContaining({
        paymentIban: "iban-sentinel",
        stripeSecretKey: "stripe-secret-sentinel",
        stripeWebhookSecret: "webhook-secret-sentinel"
      })
    )
  })

  test("shows the provider error when a Stripe connection test fails", async () => {
    const user = userEvent.setup()

    mocks.testStripeConnection.mockResolvedValueOnce({
      error: "Stripe rejected the secret key"
    })

    renderPaymentSettingsForm(configuredStripeSettings)

    await user.click(screen.getByRole("button", { name: "settings.payment.testStripeConnection" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Stripe rejected the secret key")

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith("Stripe rejected the secret key")
    })
  })

  test("shows the saved transition when payment settings are submitted successfully", async () => {
    const user = userEvent.setup()

    mocks.savePaymentSettings.mockResolvedValueOnce({
      data: {
        settings: {
          ...basePaymentSettings,
          paymentBankName: "Acme Bank",
          stripeTestConnectionAt: null
        }
      }
    })

    renderPaymentSettingsForm()

    await user.type(screen.getByLabelText("settings.payment.bankName"), "Acme Bank")

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "settings.payment.save" })).toBeEnabled()
    })

    await user.click(screen.getByRole("button", { name: "settings.payment.save" }))

    await waitFor(() => {
      expect(mocks.toastSuccess).toHaveBeenCalledWith("settings.payment.saved")
    })
  })
})
