import { database } from "@/database"

import { type PaymentSettingsValues } from "./schemas"
import { maskIbanForDisplay } from "./services/iban"

export type PaymentSettingsFormData = PaymentSettingsValues & {
  stripeTestConnectionAt: string | null
}

// What an anonymous document page may know about how to pay. Every field is either already public
// (a bank name, free-text instructions), deliberately masked (the IBAN), or a boolean standing in
// for a secret that must never leave the server (`stripeConfigured`).
export type PublicPaymentBlock = {
  bankName: string | null
  paymentIbanDisplay: string | null
  paymentInstructions: string | null
  hasBankTransferDetails: boolean
  stripeConfigured: boolean
}

type PaymentSettingsRow = {
  paymentIban: string | null
  paymentBankName: string | null
  paymentInstructions: string | null
  stripePublishableKey: string | null
  stripeSecretKey: string | null
  stripeWebhookSecret: string | null
  stripeTestConnectionAt: Date | null
}

type PublicPaymentBlockRow = {
  paymentIban: string | null
  paymentBankName: string | null
  paymentInstructions: string | null
  stripeSecretKey: string | null
  stripeWebhookSecret: string | null
}

export async function getPaymentSettings(): Promise<PaymentSettingsFormData> {
  const row = await database.query.settings.findFirst({
    columns: {
      paymentIban: true,
      paymentBankName: true,
      paymentInstructions: true,
      stripePublishableKey: true,
      stripeSecretKey: true,
      stripeWebhookSecret: true,
      stripeTestConnectionAt: true
    }
  })

  return toPaymentSettingsFormData(row ?? null)
}

export async function getPublicPaymentBlock(): Promise<PublicPaymentBlock> {
  const row = await database.query.settings.findFirst({
    columns: {
      paymentIban: true,
      paymentBankName: true,
      paymentInstructions: true,
      stripeSecretKey: true,
      stripeWebhookSecret: true
    }
  })

  return toPublicPaymentBlock(row ?? null)
}

// The three encrypted secrets are deliberately returned as empty strings with a companion
// `*Configured` boolean rather than their real values: this read model reaches a client form, and
// `security.md` forbids an encrypted field ever leaving the server. The form uses the boolean to
// show that a secret is set, and treats a blank submission as "leave unchanged".
export function toPaymentSettingsFormData(row: PaymentSettingsRow | null): PaymentSettingsFormData {
  return {
    paymentBankName: row?.paymentBankName ?? "",
    paymentIban: "",
    paymentIbanConfigured: Boolean(row?.paymentIban),
    paymentInstructions: row?.paymentInstructions ?? "",
    stripePublishableKey: row?.stripePublishableKey ?? "",
    stripeSecretKey: "",
    stripeSecretKeyConfigured: Boolean(row?.stripeSecretKey),
    stripeWebhookSecret: "",
    stripeWebhookSecretConfigured: Boolean(row?.stripeWebhookSecret),
    stripeTestConnectionAt: row?.stripeTestConnectionAt?.toISOString() ?? null
  }
}

function toPublicPaymentBlock(row: PublicPaymentBlockRow | null): PublicPaymentBlock {
  const bankName = emptyToNull(row?.paymentBankName ?? null)
  const paymentInstructions = emptyToNull(row?.paymentInstructions ?? null)
  const paymentIbanDisplay = row?.paymentIban ? maskIbanForDisplay(row.paymentIban) : null

  return {
    bankName,
    paymentIbanDisplay,
    paymentInstructions,
    hasBankTransferDetails: Boolean(bankName || paymentIbanDisplay || paymentInstructions),
    // Both secrets, matching `getStripeConfiguration` in `features/payments/stripeWebhook.ts` and
    // `stripeCheckout.ts` exactly. This boolean is what decides whether an anonymous client is shown
    // a pay button, and a secret key without a webhook secret is the one configuration that would
    // take a client's money and record nothing: the session completes, the event arrives, and the
    // signature has nothing to verify against. The publishable key is not consulted because a
    // server-side hosted Checkout Session does not need one. Neither value travels past this
    // boolean.
    stripeConfigured: Boolean(row?.stripeSecretKey && row.stripeWebhookSecret)
  }
}

function emptyToNull(value: string | null): string | null {
  const trimmed = value?.trim() ?? ""

  return trimmed.length > 0 ? trimmed : null
}
