import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { AppearanceSettingsPage } from "@/features/settings"

export const metadata: Metadata = {
  title: t("settings.metadata.appearance")
}

export default function Page() {
  return <AppearanceSettingsPage />
}
