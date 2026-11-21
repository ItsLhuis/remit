import { type WebhookEvent } from "@/features/webhooks"

import { type WebhookEndpointStatus } from "./services/endpointStatus"
import { type WebhookDeliveryStatus } from "./types"

type StatusPresentation = {
  variant: "success" | "secondary" | "error" | "info"
  icon: "CircleCheck" | "CirclePause" | "TriangleAlert" | "Clock" | "CircleX"
}

export const webhookEndpointStatusPresentation: Record<WebhookEndpointStatus, StatusPresentation> =
  {
    active: { variant: "success", icon: "CircleCheck" },
    disabled: { variant: "secondary", icon: "CirclePause" },
    failing: { variant: "error", icon: "TriangleAlert" }
  }

// How the add dialog groups the subscribable events. `__tests__/labels.test.ts` fails unless every
// entry of `WEBHOOK_EVENTS` appears here exactly once, so a new subscribable event cannot be missing
// from the picker.
export const webhookEventGroups = [
  {
    labelKey: "settings.webhooks.eventGroups.clients",
    events: ["client.created", "client.updated", "client.deleted"]
  },
  {
    labelKey: "settings.webhooks.eventGroups.projects",
    events: ["project.created", "project.updated", "project.status_changed", "project.deleted"]
  },
  {
    labelKey: "settings.webhooks.eventGroups.invoices",
    events: [
      "invoice.created",
      "invoice.updated",
      "invoice.sent",
      "invoice.paid",
      "invoice.overdue",
      "invoice.deleted"
    ]
  },
  { labelKey: "settings.webhooks.eventGroups.payments", events: ["payment.received"] },
  { labelKey: "settings.webhooks.eventGroups.time", events: ["time.logged"] },
  { labelKey: "settings.webhooks.eventGroups.expenses", events: ["expense.created"] }
] as const satisfies readonly { labelKey: string; events: readonly WebhookEvent[] }[]

export const webhookDeliveryStatusPresentation: Record<WebhookDeliveryStatus, StatusPresentation> =
  {
    pending: { variant: "info", icon: "Clock" },
    succeeded: { variant: "success", icon: "CircleCheck" },
    failed: { variant: "error", icon: "CircleX" }
  }
