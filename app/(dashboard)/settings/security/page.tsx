import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { SecuritySettingsPage } from "@/features/settings"

export const metadata: Metadata = {
  title: t("settings.metadata.security")
}

const SecurityPage = () => {
  return <SecuritySettingsPage />
}

export default SecurityPage
