export type EmailSettings = {
  emailProvider: string | null
  smtpHost: string | null
  smtpPort: number | null
  smtpUser: string | null
  smtpPass: string | null
  resendApiKey: string | null
}

export function isEmailConfigured(settings: EmailSettings | null | undefined): boolean {
  if (!settings) return false

  if (settings.emailProvider === "smtp") {
    return Boolean(settings.smtpHost && settings.smtpPort && settings.smtpUser && settings.smtpPass)
  }

  if (settings.emailProvider === "resend") {
    return Boolean(settings.resendApiKey)
  }

  return false
}
