import { and, arrayContains, eq } from "drizzle-orm"

import { type EventMap } from "@/lib/events"

import { enqueueJob } from "@/lib/jobs"

import { database } from "@/database"
import { webhookDeliveries, webhookEndpoints } from "@/database/schema"

import { WEBHOOK_TEST_EVENT, type WebhookEvent } from "./schemas"
import { WEBHOOK_BACKOFF_DELAY_MS, WEBHOOK_MAX_ATTEMPTS } from "./services/deliveryPolicy"
import {
  buildWebhookPayload,
  buildWebhookTestPayload,
  type WebhookPayload
} from "./services/payload"

// The producer half of outbound delivery. It writes one `webhook_deliveries` row per subscribed
// endpoint and queues a job per row; it never makes the HTTP request itself. Delivery is a job
// (ADR-0023) because the emitting action must not wait on somebody else's server: a slow receiver
// would become the user's latency, and a failing one their error.
export async function enqueueWebhookEvent<E extends WebhookEvent>(
  event: E,
  eventPayload: EventMap[E]
): Promise<void> {
  const endpoints = await database
    .select({ id: webhookEndpoints.id })
    .from(webhookEndpoints)
    .where(and(eq(webhookEndpoints.active, true), arrayContains(webhookEndpoints.events, [event])))

  if (endpoints.length === 0) return

  await queueDeliveries(
    endpoints.map((endpoint) => endpoint.id),
    event,
    buildWebhookPayload(event, eventPayload, new Date())
  )
}

export async function enqueueWebhookTestDelivery(endpointId: string): Promise<void> {
  await queueDeliveries(
    [endpointId],
    WEBHOOK_TEST_EVENT,
    buildWebhookTestPayload(WEBHOOK_TEST_EVENT, new Date())
  )
}

async function queueDeliveries(
  endpointIds: string[],
  event: string,
  payload: WebhookPayload
): Promise<void> {
  const rows = await database
    .insert(webhookDeliveries)
    .values(endpointIds.map((endpointId) => ({ endpointId, event, payload })))
    .returning({ id: webhookDeliveries.id })

  await Promise.all(
    rows.map((row) =>
      enqueueJob(
        "webhook.delivery.send",
        { deliveryId: row.id },
        {
          jobId: `webhook-delivery-${row.id}`,
          attempts: WEBHOOK_MAX_ATTEMPTS,
          backoffDelayMs: WEBHOOK_BACKOFF_DELAY_MS
        }
      )
    )
  )
}
