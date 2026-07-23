import { database } from "@/database"

import { type EmailSettingsValues } from "./schemas"

export type EmailSettingsFormData = EmailSettingsValues & {
  emailTestSendAt: string | null
}

type EmailSettingsRow = {
  businessName: string | null
  businessEmail: string | null
  emailProvider: "smtp" | "resend" | null
  smtpHost: string | null
  smtpPort: number | null
  smtpUser: string | null
  smtpPass: string | null
  smtpSecure: boolean
  resendApiKey: string | null
  emailFromName: string | null
  emailFromAddress: string | null
  emailTestSendAt: Date | null
}

export async function getEmailSettings(): Promise<EmailSettingsFormData> {
  const row = await database.query.settings.findFirst({
    columns: {
      businessName: true,
      businessEmail: true,
      emailProvider: true,
      smtpHost: true,
      smtpPort: true,
      smtpUser: true,
      smtpPass: true,
      smtpSecure: true,
      resendApiKey: true,
      emailFromName: true,
      emailFromAddress: true,
      emailTestSendAt: true
    }
  })

  return toEmailSettingsFormData(row ?? null)
}

// `smtpPass` and `resendApiKey` are returned as empty strings with a companion `*Configured`
// boolean rather than their stored values: this read model reaches a client form, and `security.md`
// forbids an encrypted field leaving the server. `buildEmailSettingsWritePlan` in mutations.ts
// completes the contract by treating a blank submission as "keep the stored secret".
export function toEmailSettingsFormData(row: EmailSettingsRow | null): EmailSettingsFormData {
  return {
    emailProvider: row?.emailProvider ?? "smtp",
    smtpHost: row?.smtpHost ?? "",
    smtpPort: row?.smtpPort ?? 587,
    smtpUser: row?.smtpUser ?? "",
    smtpPass: "",
    smtpPassConfigured: Boolean(row?.smtpPass),
    smtpSecure: row?.smtpSecure ?? true,
    resendApiKey: "",
    resendApiKeyConfigured: Boolean(row?.resendApiKey),
    emailFromName: row?.emailFromName ?? row?.businessName ?? "",
    emailFromAddress: row?.emailFromAddress ?? row?.businessEmail ?? "",
    emailTestSendAt: row?.emailTestSendAt?.toISOString() ?? null
  }
}
