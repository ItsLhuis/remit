import { database } from "@/database"

import { type PaymentSettingsValues } from "./schemas"
import { maskIbanForDisplay } from "./services/iban"

export type PaymentSettingsFormData = PaymentSettingsValues & {
  stripeTestConnectionAt: string | null
}

export type PublicPaymentBlock = {
  bankName: string | null
  paymentIbanDisplay: string | null
  paymentInstructions: string | null
  hasBankTransferDetails: boolean
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
      paymentInstructions: true
    }
  })

  return toPublicPaymentBlock(row ?? null)
}

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

export function toPublicPaymentBlock(row: PublicPaymentBlockRow | null): PublicPaymentBlock {
  const bankName = emptyToNull(row?.paymentBankName ?? null)
  const paymentInstructions = emptyToNull(row?.paymentInstructions ?? null)
  const paymentIbanDisplay = row?.paymentIban ? maskIbanForDisplay(row.paymentIban) : null

  return {
    bankName,
    paymentIbanDisplay,
    paymentInstructions,
    hasBankTransferDetails: Boolean(bankName || paymentIbanDisplay || paymentInstructions)
  }
}

function emptyToNull(value: string | null): string | null {
  const trimmed = value?.trim() ?? ""

  return trimmed.length > 0 ? trimmed : null
}
