import { type WebhookEvent } from "@/features/webhooks"

import { type WebhookEndpointStatus } from "./services/endpointStatus"

// No `secret`: it is shown once when minted or rotated and never read back into a page.
export type WebhookEndpointListItem = {
  id: string
  url: string
  events: WebhookEvent[]
  status: WebhookEndpointStatus
  consecutiveFailures: number
  createdAt: Date
}

export type WebhookDeliveryStatus = "pending" | "succeeded" | "failed"

export type WebhookDeliveryListItem = {
  id: string
  endpointId: string
  endpointUrl: string
  event: string
  status: WebhookDeliveryStatus
  attemptCount: number
  lastStatusCode: number | null
  createdAt: Date
}

export type WebhooksPageData = {
  endpoints: WebhookEndpointListItem[]
  deliveries: WebhookDeliveryListItem[]
  locale: string
  timeZone: string
}
