import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { ProfileSettingsPage } from "@/features/settings/server"

export const metadata: Metadata = {
  title: t("settings.metadata.profile")
}

const ProfilePage = () => {
  return <ProfileSettingsPage />
}

export default ProfilePage
