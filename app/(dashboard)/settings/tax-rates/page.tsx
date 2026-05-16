import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { TaxRatesSettingsPage } from "@/features/settings/server"

export const metadata: Metadata = {
  title: t("settings.metadata.taxRates")
}

export default TaxRatesSettingsPage
