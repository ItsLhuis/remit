import { t } from "@/lib/i18n/server"

import { getPaymentSettings } from "../../queries"

import { SettingsPageHeader } from "@/components/layout"

import { PaymentSettingsForm } from "./PaymentSettingsForm"

const PaymentSettingsPage = async () => {
  const settings = await getPaymentSettings()

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <SettingsPageHeader
        title={t("settings.payment.title")}
        description={t("settings.payment.description")}
        icon="Landmark"
      />
      <PaymentSettingsForm
        initialValues={settings}
        initialStripeTestConnectionAt={settings.stripeTestConnectionAt}
      />
    </div>
  )
}

export { PaymentSettingsPage }
