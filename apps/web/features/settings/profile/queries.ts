import { database } from "@/database"

import { isEmailConfigured } from "@/features/email/server"

export async function getProfileEmailConfigured(): Promise<boolean> {
  const settings = await database.query.settings.findFirst({
    columns: {
      emailProvider: true,
      smtpHost: true,
      smtpPort: true,
      smtpUser: true,
      smtpPass: true,
      resendApiKey: true
    }
  })

  return isEmailConfigured(settings ?? null)
}

export async function getProfileLocale(): Promise<string> {
  const settings = await database.query.settings.findFirst({
    columns: { defaultLocale: true }
  })

  return settings?.defaultLocale ?? "en"
}
