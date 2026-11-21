import { t } from "@/lib/i18n/server"

import { SettingsPageHeader } from "@/components/layout"

import { getWebhooksPageData } from "../../queries"

import { WebhookDeliveriesTable } from "./WebhookDeliveriesTable"
import { WebhookEndpointsTable } from "./WebhookEndpointsTable"

const WebhookSettingsPage = async () => {
  const pageData = await getWebhooksPageData()

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <SettingsPageHeader
        title={t("settings.webhooks.title")}
        description={t("settings.webhooks.description")}
        icon="Webhook"
      />
      <WebhookEndpointsTable
        initialEndpoints={pageData.endpoints}
        locale={pageData.locale}
        timeZone={pageData.timeZone}
      />
      <WebhookDeliveriesTable
        deliveries={pageData.deliveries}
        locale={pageData.locale}
        timeZone={pageData.timeZone}
      />
    </div>
  )
}

export { WebhookSettingsPage }
