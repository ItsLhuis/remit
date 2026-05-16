import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { TemplatesSettingsPage } from "@/features/settings/server"

export const metadata: Metadata = {
  title: t("settings.metadata.templates")
}

export default TemplatesSettingsPage
