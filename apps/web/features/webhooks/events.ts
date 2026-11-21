import { on, type EventMap } from "@/lib/events"

import { logger } from "@/lib/logger"

import { enqueueWebhookEvent } from "./deliveries"
import { WEBHOOK_EVENTS, type WebhookEvent } from "./schemas"

// One subscriber per subscribable event, registered at module load. Imported by
// `instrumentation.ts` for events emitted by requests and by the worker's module loader for the
// ones its sweeps emit (`invoice.overdue`, for one), because nothing under `lib/` may import a
// feature.
//
// The handler only queues. It never throws, per `.agents/rules/events.md`: a failure to queue a
// webhook must not fail the payment or invoice write that emitted the event.
for (const event of WEBHOOK_EVENTS) subscribe(event)

function subscribe<E extends WebhookEvent>(event: E): void {
  on(event, async (payload: EventMap[E]) => {
    try {
      await enqueueWebhookEvent(event, payload)
    } catch (error) {
      logger.error(
        { action: "webhooks.relay", event, err: error },
        "Webhook deliveries could not be queued"
      )
    }
  })
}
