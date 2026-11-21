import { t } from "@/lib/i18n/server"

import { SettingsPageHeader } from "@/components/layout"

import { getTaxRateDefaults, getTaxRates } from "../../queries"

import { TaxRatesSettingsForm } from "./TaxRatesSettingsForm"

const TaxRatesSettingsPage = async () => {
  const [taxRates, defaults] = await Promise.all([getTaxRates(), getTaxRateDefaults()])

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <SettingsPageHeader
        title={t("settings.taxRates.title")}
        description={t("settings.taxRates.description")}
        icon="Percent"
      />
      <TaxRatesSettingsForm initialTaxRates={taxRates} locale={defaults.defaultLocale} />
    </div>
  )
}

export { TaxRatesSettingsPage }
