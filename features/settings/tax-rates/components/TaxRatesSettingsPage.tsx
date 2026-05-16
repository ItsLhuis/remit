import { t } from "@/lib/i18n/server"

import { SettingsPageHeader } from "@/components/layout"

const TaxRatesSettingsPage = () => {
  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <SettingsPageHeader
        title={t("settings.taxRates.title")}
        description={t("settings.taxRates.description")}
        icon="Percent"
      />
    </div>
  )
}

export { TaxRatesSettingsPage }
