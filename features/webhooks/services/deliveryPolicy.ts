// Six attempts, the first immediate and then exponential from thirty seconds — 30 s, 1 min, 2 min,
// 4 min and 8 min — so a receiver that is down for a deploy or a quarter of an hour still gets the
// event, and one that is gone for good stops costing the worker anything within about sixteen
// minutes.
export const WEBHOOK_MAX_ATTEMPTS = 6

export const WEBHOOK_BACKOFF_DELAY_MS = 30 * 1000

// An endpoint whose deliveries have exhausted every retry this many times in a row is switched off
// rather than retried forever. It stays configured, says why on the settings surface, and the owner
// turns it back on once the receiver is fixed.
export const WEBHOOK_DISABLE_AFTER_FAILURES = 10

export const WEBHOOK_DELIVERY_RETENTION_DAYS = 30

export type WebhookAttemptOutcome =
  | "delivered"
  | "http_error"
  | "redirect"
  | "timeout"
  | "network_error"
  | "blocked"
  | "endpoint_inactive"

export type WebhookDeliveryDecision = "succeeded" | "retry" | "failed"

// Only a 2xx is a delivery. A redirect is never followed (a public host that redirects to a private
// one is the textbook way around an address check), so it is a failure — and a permanent one, like
// a refused address or a disabled endpoint, because retrying the same request cannot change the
// answer. Everything else, including a 4xx, is retried: receivers answer 404 during a deploy and 400
// while they roll back.
export function classifyHttpStatus(statusCode: number): WebhookAttemptOutcome {
  if (statusCode >= 200 && statusCode < 300) return "delivered"

  if (statusCode >= 300 && statusCode < 400) return "redirect"

  return "http_error"
}

export function decideWebhookDelivery(
  outcome: WebhookAttemptOutcome,
  attemptNumber: number
): WebhookDeliveryDecision {
  if (outcome === "delivered") return "succeeded"

  if (outcome === "redirect" || outcome === "blocked" || outcome === "endpoint_inactive") {
    return "failed"
  }

  return attemptNumber >= WEBHOOK_MAX_ATTEMPTS ? "failed" : "retry"
}

export function shouldDisableWebhookEndpoint(consecutiveFailures: number): boolean {
  return consecutiveFailures >= WEBHOOK_DISABLE_AFTER_FAILURES
}
