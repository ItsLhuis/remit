import { redirect } from "next/navigation"

import { headers } from "next/headers"

import { type Metadata } from "next"

import { eq } from "drizzle-orm"

import { auth } from "@/lib/auth"

import { database } from "@/database"
import { settings } from "@/database/schema"

import { ProfileSettingsPage } from "@/features/settings/profile/components"

export const metadata: Metadata = {
  title: "Profile — Settings"
}

const ProfilePage = async () => {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session) redirect("/login")

  const userSettings = await database.query.settings.findFirst({
    where: eq(settings.userId, session.user.id),
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
