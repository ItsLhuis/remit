import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { requireRole } from "@/lib/auth/session"

import { ApiSettingsPage } from "@/features/settings/server"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: t("settings.metadata.api")
}

const ApiSettingsRoute = async () => {
  await requireRole("owner")

  return <ApiSettingsPage />
}

export default ApiSettingsRoute
