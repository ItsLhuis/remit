import { and, eq, lt, ne, sql } from "drizzle-orm"

import { writeAudit } from "@/lib/audit"

import { logger } from "@/lib/logger"

import { env } from "@/lib/config/env"

import { database } from "@/database"
import { webhookDeliveries, webhookEndpoints } from "@/database/schema"

import { safePost, type SafePostResult, type WebhookResolver } from "./safePost"
import {
  decideWebhookDelivery,
  shouldDisableWebhookEndpoint,
  WEBHOOK_DELIVERY_RETENTION_DAYS,
  type WebhookDeliveryDecision
} from "./services/deliveryPolicy"
import { signWebhookPayload } from "./services/signature"
import { evaluateWebhookUrl } from "./services/webhookUrl"

export type SendWebhookDeliveryOptions = {
  now?: Date
  resolve?: WebhookResolver
}

type DeliveryRow = {
  id: string
  endpointId: string
  status: "pending" | "succeeded" | "failed"
  attemptCount: number
  payload: unknown
  url: string
  secret: string
  active: boolean
}

// Thrown after a failed attempt has been recorded, so BullMQ schedules the next one with backoff.
// The message names nothing about the endpoint: the worker logs it, and a URL can carry a token in
// its query string.
export class WebhookRetryError extends Error {
  constructor() {
    super("Webhook delivery attempt did not succeed and will be retried")
  }
}

const DAY_MS = 24 * 60 * 60 * 1000

// One attempt per call. The attempt is recorded before the job either finishes or throws for a
// retry, so the history is complete even when the worker dies between attempts, and the conditional
// update on the attempt count read at the start is what makes a re-delivered job a no-op rather
// than a second request.
export async function sendWebhookDelivery(
  deliveryId: string,
  options: SendWebhookDeliveryOptions = {}
): Promise<WebhookDeliveryDecision | null> {
  const row = await loadDelivery(deliveryId)

  if (row?.status !== "pending") return null

  const attemptedAt = options.now ?? new Date()
  const attemptNumber = row.attemptCount + 1

  const result: SafePostResult = row.active
    ? await attemptDelivery(row, attemptedAt, options.resolve)
    : { outcome: "endpoint_inactive", statusCode: null }

  const decision = decideWebhookDelivery(result.outcome, attemptNumber)

  const recorded = await recordAttempt(row, { attemptNumber, attemptedAt, result, decision })

  if (!recorded) return null

  if (result.outcome !== "endpoint_inactive") await settleEndpoint(row.endpointId, decision)

  if (decision !== "retry") await pruneDeliveries(row.endpointId, attemptedAt)

  if (decision === "retry") throw new WebhookRetryError()

  return decision
}

async function loadDelivery(deliveryId: string): Promise<DeliveryRow | null> {
  const [row] = await database
    .select({
      id: webhookDeliveries.id,
      endpointId: webhookDeliveries.endpointId,
      status: webhookDeliveries.status,
      attemptCount: webhookDeliveries.attemptCount,
      payload: webhookDeliveries.payload,
      url: webhookEndpoints.url,
      secret: webhookEndpoints.secret,
      active: webhookEndpoints.active
    })
    .from(webhookDeliveries)
    .innerJoin(webhookEndpoints, eq(webhookEndpoints.id, webhookDeliveries.endpointId))
    .where(eq(webhookDeliveries.id, deliveryId))
    .limit(1)

  return row ?? null
}

// The URL is evaluated again here rather than trusted from when it was saved, because the operator's
// allowlist may have changed since, and a host removed from it must stop receiving immediately.
async function attemptDelivery(
  row: DeliveryRow,
  attemptedAt: Date,
  resolve: WebhookResolver | undefined
): Promise<SafePostResult> {
  const evaluation = evaluateWebhookUrl(row.url, env.REMIT_WEBHOOK_ALLOWED_HOSTS)

  if (!evaluation.ok) return { outcome: "blocked", statusCode: null }

  const body = JSON.stringify(row.payload)
  const timestampSeconds = Math.floor(attemptedAt.getTime() / 1000)

  return safePost({
    url: evaluation.url,
    allowPrivate: evaluation.allowPrivate,
    body,
    resolve,
    headers: {
      "content-type": "application/json",
      "user-agent": "Remit-Webhooks",
      "webhook-id": row.id,
      "webhook-timestamp": String(timestampSeconds),
      "webhook-signature": signWebhookPayload({
        messageId: row.id,
        timestampSeconds,
        body,
        secret: row.secret
      })
    }
  })
}

type RecordedAttempt = {
  attemptNumber: number
  attemptedAt: Date
  result: SafePostResult
  decision: WebhookDeliveryDecision
}

async function recordAttempt(
  row: DeliveryRow,
  { attemptNumber, attemptedAt, result, decision }: RecordedAttempt
): Promise<boolean> {
  const entry = {
    attempt: attemptNumber,
    at: attemptedAt.toISOString(),
    statusCode: result.statusCode,
    outcome: result.outcome
  }

  const updated = await database
    .update(webhookDeliveries)
    .set({
      attemptCount: attemptNumber,
      attempts: sql`${webhookDeliveries.attempts} || ${JSON.stringify([entry])}::jsonb`,
      lastStatusCode: result.statusCode,
      status: decision === "retry" ? "pending" : decision,
      completedAt: decision === "retry" ? null : attemptedAt
    })
    .where(
      and(
        eq(webhookDeliveries.id, row.id),
        eq(webhookDeliveries.status, "pending"),
        eq(webhookDeliveries.attemptCount, row.attemptCount)
      )
    )
    .returning({ id: webhookDeliveries.id })

  return updated.length > 0
}

// A success clears the failure streak; a delivery that exhausted its retries extends it, and the
// streak crossing the threshold switches the endpoint off. A retry in progress touches neither: one
// flaky attempt is not a failed delivery.
async function settleEndpoint(
  endpointId: string,
  decision: WebhookDeliveryDecision
): Promise<void> {
  if (decision === "retry") return

  if (decision === "succeeded") {
    await database
      .update(webhookEndpoints)
      .set({ consecutiveFailures: 0 })
      .where(eq(webhookEndpoints.id, endpointId))

    return
  }

  const [endpoint] = await database
    .update(webhookEndpoints)
    .set({ consecutiveFailures: sql`${webhookEndpoints.consecutiveFailures} + 1` })
    .where(eq(webhookEndpoints.id, endpointId))
    .returning({
      consecutiveFailures: webhookEndpoints.consecutiveFailures,
      active: webhookEndpoints.active
    })

  if (!endpoint?.active || !shouldDisableWebhookEndpoint(endpoint.consecutiveFailures)) return

  const disabled = await database
    .update(webhookEndpoints)
    .set({ active: false, disabledReason: "consecutive_failures" })
    .where(and(eq(webhookEndpoints.id, endpointId), eq(webhookEndpoints.active, true)))
    .returning({ id: webhookEndpoints.id })

  if (disabled.length === 0) return

  logger.warn(
    { action: "webhooks.delivery", endpointId, consecutiveFailures: endpoint.consecutiveFailures },
    "Webhook endpoint disabled after consecutive failed deliveries"
  )

  await writeAudit("webhook.endpoint.auto_disabled", {
    targetEntityType: "webhook_endpoint",
    targetEntityId: endpointId,
    metadata: { consecutiveFailures: endpoint.consecutiveFailures }
  })
}

// Bounded by age rather than by a sweep of its own: every completed delivery trims its endpoint's
// history, so a busy endpoint's log stays short and an idle one has nothing to trim.
async function pruneDeliveries(endpointId: string, now: Date): Promise<void> {
  await database
    .delete(webhookDeliveries)
    .where(
      and(
        eq(webhookDeliveries.endpointId, endpointId),
        ne(webhookDeliveries.status, "pending"),
        lt(
          webhookDeliveries.createdAt,
          new Date(now.getTime() - WEBHOOK_DELIVERY_RETENTION_DAYS * DAY_MS)
        )
      )
    )
}
