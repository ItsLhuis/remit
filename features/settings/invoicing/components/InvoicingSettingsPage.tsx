import { t } from "@/lib/i18n/server"

import { SettingsPageHeader } from "@/components/layout"

const InvoicingSettingsPage = () => {
  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <SettingsPageHeader
        title={t("settings.invoicing.title")}
        description={t("settings.invoicing.description")}
        icon="FileText"
      />
    </div>
  )
}

export { InvoicingSettingsPage }
