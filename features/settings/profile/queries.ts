import { database } from "@/database"

import { isEmailConfigured } from "../services/isEmailConfigured"

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
