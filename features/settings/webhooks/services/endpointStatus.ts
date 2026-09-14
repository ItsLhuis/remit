export type WebhookEndpointStatus = "active" | "disabled" | "failing"

// `failing` is the delivery job's own switch-off (`features/webhooks/delivery.ts`'s
// `settleEndpoint`), told apart from the owner's so the list can say which of them turned it off.
// `chk_webhook_endpoints_disabled_reason` guarantees an inactive row carries one of the two reasons.
export function getWebhookEndpointStatus(endpoint: {
  active: boolean
  disabledReason: string | null
}): WebhookEndpointStatus {
  if (endpoint.active) return "active"

  return endpoint.disabledReason === "consecutive_failures" ? "failing" : "disabled"
}
