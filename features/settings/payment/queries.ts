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
      stripeSecretKey: true
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
    // The secret key alone, because that is what a server-side Checkout Session needs; the
    // publishable key is not required to start one. The key itself is read only to be collapsed
    // into this boolean and never travels further.
    stripeConfigured: Boolean(row?.stripeSecretKey)
  }
}

function emptyToNull(value: string | null): string | null {
  const trimmed = value?.trim() ?? ""

  return trimmed.length > 0 ? trimmed : null
}
