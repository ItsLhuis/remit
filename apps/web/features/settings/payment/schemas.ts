import { z } from "zod"

import i18n from "@/lib/i18n/i18n"

import { isValidIban } from "./services/iban"

const optionalTextSchema = z.string().trim()

const optionalIbanSchema = optionalTextSchema.refine(
  (value) => value === "" || isValidIban(value),
  {
    message: i18n.t("settings.payment.validation.ibanInvalid")
  }
)

const optionalStripePublishableKeySchema = optionalTextSchema.refine(
  (value) => value === "" || /^pk_(test|live)_[A-Za-z0-9]+$/.test(value),
  {
    message: i18n.t("settings.payment.validation.stripePublishableKeyInvalid")
  }
)

const optionalStripeSecretKeySchema = optionalTextSchema.refine(
  (value) => value === "" || /^sk_(test|live)_[A-Za-z0-9]+$/.test(value),
  {
    message: i18n.t("settings.payment.validation.stripeSecretKeyInvalid")
  }
)

const optionalStripeWebhookSecretSchema = optionalTextSchema.refine(
  (value) => value === "" || /^whsec_[A-Za-z0-9]+$/.test(value),
  {
    message: i18n.t("settings.payment.validation.stripeWebhookSecretInvalid")
  }
)

export const paymentSettingsSchema = z
  .object({
    paymentBankName: optionalTextSchema,
    paymentIban: optionalIbanSchema,
    paymentIbanConfigured: z.boolean(),
    paymentInstructions: optionalTextSchema,
    stripePublishableKey: optionalStripePublishableKeySchema,
    stripeSecretKey: optionalStripeSecretKeySchema,
    stripeSecretKeyConfigured: z.boolean(),
    stripeWebhookSecret: optionalStripeWebhookSecretSchema,
    stripeWebhookSecretConfigured: z.boolean()
  })
  .superRefine((values, context) => {
    const hasPublishableKey = values.stripePublishableKey.length > 0
    const hasSubmittedSecretKey = values.stripeSecretKey.length > 0
    const hasConfiguredSecretKey = values.stripeSecretKeyConfigured

    if (hasPublishableKey && !hasSubmittedSecretKey && !hasConfiguredSecretKey) {
      context.addIssue({
        code: "custom",
        path: ["stripeSecretKey"],
        message: i18n.t("settings.payment.validation.stripeSecretKeyRequired")
      })
    }

    if (!hasPublishableKey && hasSubmittedSecretKey) {
      context.addIssue({
        code: "custom",
        path: ["stripePublishableKey"],
        message: i18n.t("settings.payment.validation.stripePublishableKeyRequired")
      })
    }
  })

export type PaymentSettingsValues = z.infer<typeof paymentSettingsSchema>
export type PaymentSettingsInputValues = z.input<typeof paymentSettingsSchema>

export const testStripeConnectionSchema = z.object({})
