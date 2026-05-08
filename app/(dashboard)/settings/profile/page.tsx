import { type Metadata } from "next"

import { headers } from "next/headers"

import { redirect } from "next/navigation"

import { t } from "@/lib/i18n/server"

import { auth } from "@/lib/auth"

import { ProfileSettingsPage } from "@/features/settings"
import { getProfileEmailConfigured } from "@/features/settings/server"

export const metadata: Metadata = {
  title: t("settings.metadata.profile")
}

const ProfilePage = async () => {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session) redirect("/login")

  const emailConfigured = await getProfileEmailConfigured()

  return <ProfileSettingsPage user={session.user} emailConfigured={emailConfigured} />
}

export default ProfilePage
