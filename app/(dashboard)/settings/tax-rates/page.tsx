import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { requireRole } from "@/lib/auth/session"

import { TaxRatesSettingsPage } from "@/features/settings/server"

export const metadata: Metadata = {
  title: t("settings.metadata.taxRates")
}

const TaxRatesSettingsRoute = async () => {
  await requireRole("owner")

  return <TaxRatesSettingsPage />
}

export default TaxRatesSettingsRoute
