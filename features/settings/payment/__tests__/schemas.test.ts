import { expect, test } from "vitest"

import { paymentSettingsSchema } from "../schemas"

const validPaymentSettings = {
  paymentBankName: "Acme Bank",
  paymentIban: "GB82 WEST 1234 5698 7654 32",
  paymentIbanConfigured: false,
  paymentInstructions: "Use the invoice number as the transfer reference.",
  stripePublishableKey: "pk_test_123456789",
  stripeSecretKey: "sk_test_123456789",
  stripeSecretKeyConfigured: false,
  stripeWebhookSecret: "whsec_123456789",
  stripeWebhookSecretConfigured: false
}

test("accepts complete bank-transfer and Stripe settings", () => {
  const result = paymentSettingsSchema.safeParse(validPaymentSettings)

  expect(result.success).toBe(true)
})

test("accepts bank-transfer settings without Stripe configured", () => {
  const result = paymentSettingsSchema.safeParse({
    ...validPaymentSettings,
    stripePublishableKey: "",
    stripeSecretKey: "",
    stripeWebhookSecret: ""
  })

  expect(result.success).toBe(true)
})

test("accepts blank encrypted values when they are already configured", () => {
  const result = paymentSettingsSchema.safeParse({
    ...validPaymentSettings,
    paymentIban: "",
    paymentIbanConfigured: true,
    stripeSecretKey: "",
    stripeSecretKeyConfigured: true,
    stripeWebhookSecret: "",
    stripeWebhookSecretConfigured: true
  })

  expect(result.success).toBe(true)
})

test("rejects an invalid IBAN", () => {
  const result = paymentSettingsSchema.safeParse({
    ...validPaymentSettings,
    paymentIban: "not-an-iban"
  })

  expect(result.success).toBe(false)
})

test("rejects a publishable key without a configured secret key", () => {
  const result = paymentSettingsSchema.safeParse({
    ...validPaymentSettings,
    stripeSecretKey: "",
    stripeSecretKeyConfigured: false
  })

  expect(result.success).toBe(false)
})

test("rejects a submitted secret key without a publishable key", () => {
  const result = paymentSettingsSchema.safeParse({
    ...validPaymentSettings,
    stripePublishableKey: ""
  })

  expect(result.success).toBe(false)
})

test("rejects an invalid Stripe webhook signing secret", () => {
  const result = paymentSettingsSchema.safeParse({
    ...validPaymentSettings,
    stripeWebhookSecret: "not-a-webhook-secret"
  })

  expect(result.success).toBe(false)
})
