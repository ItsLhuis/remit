import { type EventMap } from "@/lib/events"

import { type WebhookEvent } from "../schemas"

export type WebhookPayload = {
  type: string
  timestamp: string
  data: Record<string, unknown>
}

// What leaves the instance for each event: record ids and the few scalar facts the event is about,
// and nothing else. A full invoice in the payload would be convenient and would also be a copy of
// client data sent to a URL somebody typed; the receiver holds, or can be given, an API token to
// fetch the rest, which is also what keeps it reading the current state rather than a snapshot.
// `userId` and `changedFields` are dropped from every event — who inside the instance acted, and
// which fields they touched, are not the receiver's business.
//
// Typed so every entry can only name keys its event actually carries, and a new subscribable event
// fails the compiler until its allowlist is written here.
const WEBHOOK_PAYLOAD_FIELDS: { [E in WebhookEvent]: readonly (keyof EventMap[E])[] } = {
  "client.created": ["clientId"],
  "client.updated": ["clientId"],
  "client.deleted": ["clientId"],
  "project.created": ["projectId"],
  "project.updated": ["projectId"],
  "project.status_changed": ["projectId", "from", "to"],
  "project.deleted": ["projectId"],
  "invoice.created": ["invoiceId", "projectId", "clientId"],
  "invoice.updated": ["invoiceId"],
  "invoice.sent": ["invoiceId"],
  "invoice.paid": ["invoiceId"],
  "invoice.overdue": ["invoiceId", "clientId", "daysOverdue"],
  "invoice.deleted": ["invoiceId"],
  "payment.received": ["paymentId", "invoiceId"],
  "time.logged": ["timeEntryId", "projectId", "taskId", "durationSeconds", "billable"],
  "expense.created": ["expenseId", "projectId", "clientId", "rebillable"]
}

export function buildWebhookPayload<E extends WebhookEvent>(
  event: E,
  eventPayload: EventMap[E],
  occurredAt: Date
): WebhookPayload {
  const fields: readonly (keyof EventMap[E])[] = WEBHOOK_PAYLOAD_FIELDS[event]
  const data: Record<string, unknown> = {}

  for (const field of fields) {
    data[String(field)] = eventPayload[field] ?? null
  }

  return { type: event, timestamp: occurredAt.toISOString(), data }
}

export function buildWebhookTestPayload(type: string, occurredAt: Date): WebhookPayload {
  return { type, timestamp: occurredAt.toISOString(), data: {} }
}
