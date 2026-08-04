import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { requireRole } from "@/lib/auth/session"

import { InvoicingSettingsPage } from "@/features/settings/server"

export const metadata: Metadata = {
  title: t("settings.metadata.invoicing")
}

const InvoicingSettingsRoute = async () => {
  await requireRole("owner")

  return <InvoicingSettingsPage />
}

export default InvoicingSettingsRoute
