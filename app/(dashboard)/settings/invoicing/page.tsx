import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { InvoicingSettingsPage } from "@/features/settings"

export const metadata: Metadata = {
  title: t("settings.metadata.invoicing")
}

export default InvoicingSettingsPage
