import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { requireRole } from "@/lib/auth/session"

import { BusinessSettingsPage } from "@/features/settings/server"

export const metadata: Metadata = {
  title: t("settings.metadata.business")
}

const BusinessSettingsRoute = async () => {
  await requireRole("owner")

  return <BusinessSettingsPage />
}

export default BusinessSettingsRoute
