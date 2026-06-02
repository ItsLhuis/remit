import { t } from "@/lib/i18n/server"

import { getInvoicingSettings } from "../queries"

import { SettingsPageHeader } from "@/components/layout"

import { InvoicingSettingsForm } from "./InvoicingSettingsForm"

const InvoicingSettingsPage = async () => {
  const settings = await getInvoicingSettings()

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <SettingsPageHeader
        title={t("settings.invoicing.title")}
        description={t("settings.invoicing.description")}
        icon="FileText"
      />
      <InvoicingSettingsForm initialValues={settings} />
    </div>
  )
}

export { InvoicingSettingsPage }
