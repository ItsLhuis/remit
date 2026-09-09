import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { requireRole } from "@/lib/auth/session"

import { BackupSettingsPage } from "@/features/settings/server"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: t("settings.metadata.backup")
}

const BackupSettingsRoute = async () => {
  await requireRole("owner")

  return <BackupSettingsPage />
}

export default BackupSettingsRoute
