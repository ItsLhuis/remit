import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { EmailSettingsPage } from "@/features/settings"

export const metadata: Metadata = {
  title: t("settings.metadata.email")
}

export default EmailSettingsPage
