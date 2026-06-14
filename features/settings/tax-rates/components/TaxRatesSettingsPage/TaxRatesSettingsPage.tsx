import { t } from "@/lib/i18n/server"

import { getTaxRates } from "../../queries"

import { SettingsPageHeader } from "@/components/layout"

import { TaxRatesSettingsForm } from "./TaxRatesSettingsForm"

const TaxRatesSettingsPage = async () => {
  const taxRates = await getTaxRates()

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <SettingsPageHeader
        title={t("settings.taxRates.title")}
        description={t("settings.taxRates.description")}
        icon="Percent"
      />
      <TaxRatesSettingsForm initialTaxRates={taxRates} />
    </div>
  )
}

export { TaxRatesSettingsPage }
