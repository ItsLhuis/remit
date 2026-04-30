import { redirect } from "next/navigation"

import { headers } from "next/headers"

import { type Metadata } from "next"

import { auth } from "@/lib/auth"

import { database } from "@/database"

import { ProfileSettingsPage } from "@/features/settings/profile/components"

export const metadata: Metadata = {
  title: "Profile - Settings"
}

const ProfilePage = async () => {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session) redirect("/login")

  const userSettings = await database.query.settings.findFirst({
    columns: {
      emailProvider: true,
      smtpHost: true,
      smtpPort: true,
      smtpUser: true,
      smtpPass: true,
      resendApiKey: true
    }
  })

  const emailConfigured =
    userSettings?.emailProvider === "smtp"
      ? Boolean(
          userSettings.smtpHost &&
          userSettings.smtpPort &&
          userSettings.smtpUser &&
          userSettings.smtpPass
        )
      : userSettings?.emailProvider === "resend"
        ? Boolean(userSettings.resendApiKey)
        : false

  return <ProfileSettingsPage user={session.user} emailConfigured={emailConfigured} />
}

export default ProfilePage
