import { t } from "@/lib/i18n/server"

import { SettingsPageHeader } from "@/components/layout"

const PaymentSettingsPage = () => {
  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <SettingsPageHeader
        title={t("settings.payment.title")}
        description={t("settings.payment.description")}
        icon="Landmark"
      />
    </div>
  )
}

export { PaymentSettingsPage }
