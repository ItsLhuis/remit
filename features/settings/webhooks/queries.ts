import { desc, eq } from "drizzle-orm"

import { database } from "@/database"
import { webhookDeliveries, webhookEndpoints } from "@/database/schema"

import { isWebhookEvent } from "@/features/webhooks"

import { getWebhookEndpointStatus } from "./services/endpointStatus"
import {
  type WebhookDeliveryListItem,
  type WebhookEndpointListItem,
  type WebhooksPageData
} from "./types"

type WebhookEndpointRow = {
  id: string
  url: string
  events: string[]
  active: boolean
  disabledReason: string | null
  consecutiveFailures: number
  createdAt: Date
}

const RECENT_DELIVERY_LIMIT = 50

// `secret` is never selected. It is readable — it is encrypted, not hashed, because every delivery
// signs with it — but only `features/webhooks/delivery.ts` has a reason to decrypt it.
export const webhookEndpointListColumns = {
  id: webhookEndpoints.id,
  url: webhookEndpoints.url,
  events: webhookEndpoints.events,
  active: webhookEndpoints.active,
  disabledReason: webhookEndpoints.disabledReason,
  consecutiveFailures: webhookEndpoints.consecutiveFailures,
  createdAt: webhookEndpoints.createdAt
}

export async function getWebhooksPageData(): Promise<WebhooksPageData> {
  const [endpointRows, deliveryRows, instanceSettings] = await Promise.all([
    database
      .select(webhookEndpointListColumns)
      .from(webhookEndpoints)
      .orderBy(desc(webhookEndpoints.createdAt)),
    database
      .select({
        id: webhookDeliveries.id,
        endpointId: webhookDeliveries.endpointId,
        endpointUrl: webhookEndpoints.url,
        event: webhookDeliveries.event,
        status: webhookDeliveries.status,
        attemptCount: webhookDeliveries.attemptCount,
        lastStatusCode: webhookDeliveries.lastStatusCode,
        createdAt: webhookDeliveries.createdAt
      })
      .from(webhookDeliveries)
      .innerJoin(webhookEndpoints, eq(webhookEndpoints.id, webhookDeliveries.endpointId))
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(RECENT_DELIVERY_LIMIT),
    database.query.settings.findFirst({ columns: { defaultLocale: true, defaultTimezone: true } })
  ])

  return {
    endpoints: endpointRows.map(toWebhookEndpointListItem),
    deliveries: deliveryRows satisfies WebhookDeliveryListItem[],
    locale: instanceSettings?.defaultLocale ?? "en",
    timeZone: instanceSettings?.defaultTimezone ?? "UTC"
  }
}

// An event name dropped from `WEBHOOK_EVENTS` after an endpoint subscribed to it stays in the row
// but is no longer delivered or shown.
export function toWebhookEndpointListItem(row: WebhookEndpointRow): WebhookEndpointListItem {
  return {
    id: row.id,
    url: row.url,
    events: row.events.filter(isWebhookEvent),
    status: getWebhookEndpointStatus(row),
    consecutiveFailures: row.consecutiveFailures,
    createdAt: row.createdAt
  }
}
