import { z } from "zod"

import { type EventMap } from "@/lib/events"

// The events an endpoint may subscribe to: a subset of `lib/events/types.ts`'s `EventMap`, never a
// second vocabulary, and checked against it by the compiler. The subset is the domain events on the
// five resources the public API reads, plus the one money event those resources summarise; auth,
// membership, settings and template events are excluded because they describe the instance's
// security and configuration rather than its business, and would leave it to a URL a user typed.
export const WEBHOOK_EVENTS = [
  "client.created",
  "client.updated",
  "client.deleted",
  "project.created",
  "project.updated",
  "project.status_changed",
  "project.deleted",
  "invoice.created",
  "invoice.updated",
  "invoice.sent",
  "invoice.paid",
  "invoice.overdue",
  "invoice.deleted",
  "payment.received",
  "time.logged",
  "expense.created"
] as const satisfies readonly (keyof EventMap)[]

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]

// Sent only by the settings surface's test action, and never subscribable.
export const WEBHOOK_TEST_EVENT = "webhook.test"

export const WEBHOOK_URL_MAX_LENGTH = 2048

export const webhookEventSchema = z.enum(WEBHOOK_EVENTS)

export function isWebhookEvent(value: string): value is WebhookEvent {
  return (WEBHOOK_EVENTS as readonly string[]).includes(value)
}
