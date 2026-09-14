"use server"

import { revalidatePath } from "next/cache"

import { headers } from "next/headers"

import { eq } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { auth } from "@/lib/auth"
import { getCurrentRole, type Role } from "@/lib/auth/session"

import { writeAudit } from "@/lib/audit"

import { logger } from "@/lib/logger"

import { getIpAddress } from "@/lib/utils"

import { env } from "@/lib/config/env"

import { database } from "@/database"
import { webhookEndpoints } from "@/database/schema"

import {
  enqueueWebhookTestDelivery,
  evaluateWebhookUrl,
  mintWebhookSecret,
  type WebhookUrlRefusal
} from "@/features/webhooks/server"

import { toWebhookEndpointListItem, webhookEndpointListColumns } from "./queries"
import {
  createWebhookEndpointSchema,
  setWebhookEndpointActiveSchema,
  webhookEndpointIdSchema
} from "./schemas"
import { type WebhookEndpointListItem } from "./types"

type CreateWebhookEndpointResult =
  | { data: { endpoint: WebhookEndpointListItem; secret: string } }
  | { error: string }

type RotateWebhookSecretResult =
  | { data: { endpointId: string; secret: string } }
  | { error: string }

type SetWebhookEndpointActiveResult =
  | { data: { endpoint: WebhookEndpointListItem } }
  | { error: string }

type WebhookEndpointActionResult = { data: { endpointId: string } } | { error: string }

type WebhookWriteContext = {
  userId: string
  role: Role
  ipAddress: string | null
  userAgent: string | null
}

type WebhookWriteGate = { context: WebhookWriteContext } | { error: string }

type WebhookAuditEvent =
  | "webhook.endpoint.created"
  | "webhook.endpoint.secret_rotated"
  | "webhook.endpoint.enabled"
  | "webhook.endpoint.disabled"
  | "webhook.endpoint.deleted"

const webhooksPath = "/settings/webhooks"

// The signing secret leaves this action once, in the return value the dialog reveals. Audit entries
// name the endpoint's host and never its full URL, because a receiver's URL can itself carry a token
// in its query string.
export async function createWebhookEndpoint(input: unknown): Promise<CreateWebhookEndpointResult> {
  const gate = await requireWebhookWrite()

  if ("error" in gate) return gate

  const parsed = createWebhookEndpointSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const evaluation = evaluateWebhookUrl(parsed.data.url, env.REMIT_WEBHOOK_ALLOWED_HOSTS)

  if (!evaluation.ok) return { error: getUrlRefusalMessage(evaluation.reason) }

  const { context } = gate
  const events = Array.from(new Set(parsed.data.events))
  const secret = mintWebhookSecret()

  try {
    const [row] = await database
      .insert(webhookEndpoints)
      .values({
        url: evaluation.url.toString(),
        events,
        secret,
        createdByUserId: context.userId
      })
      .returning(webhookEndpointListColumns)

    if (!row) throw new Error("Webhook endpoint insert returned no row")

    await writeWebhookAudit(context, "webhook.endpoint.created", row.id, {
      host: evaluation.url.host,
      events
    })

    revalidatePath(webhooksPath)

    return { data: { endpoint: toWebhookEndpointListItem(row), secret } }
  } catch (error) {
    return handleWebhookError(error, "createWebhookEndpoint", context.userId, "createFailed")
  }
}

// The old secret stops verifying at once. Standard Webhooks allows a signature per secret during a
// changeover; that grace period is not offered, so the owner updates the receiver straight after.
export async function rotateWebhookEndpointSecret(
  input: unknown
): Promise<RotateWebhookSecretResult> {
  const gate = await requireWebhookWrite()

  if ("error" in gate) return gate

  const parsed = webhookEndpointIdSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate
  const secret = mintWebhookSecret()

  try {
    const [row] = await database
      .update(webhookEndpoints)
      .set({ secret })
      .where(eq(webhookEndpoints.id, parsed.data.endpointId))
      .returning({ id: webhookEndpoints.id, url: webhookEndpoints.url })

    if (!row) return { error: t("settings.webhooks.errors.notFound") }

    await writeWebhookAudit(context, "webhook.endpoint.secret_rotated", row.id, {
      host: new URL(row.url).host
    })

    revalidatePath(webhooksPath)

    return { data: { endpointId: row.id, secret } }
  } catch (error) {
    return handleWebhookError(error, "rotateWebhookEndpointSecret", context.userId, "updateFailed")
  }
}

// Turning an endpoint back on clears its failure streak, so one more failed delivery does not switch
// it straight off again.
export async function setWebhookEndpointActive(
  input: unknown
): Promise<SetWebhookEndpointActiveResult> {
  const gate = await requireWebhookWrite()

  if ("error" in gate) return gate

  const parsed = setWebhookEndpointActiveSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate
  const { endpointId, active } = parsed.data

  try {
    const [row] = await database
      .update(webhookEndpoints)
      .set(
        active
          ? { active: true, disabledReason: null, consecutiveFailures: 0 }
          : { active: false, disabledReason: "manual" }
      )
      .where(eq(webhookEndpoints.id, endpointId))
      .returning(webhookEndpointListColumns)

    if (!row) return { error: t("settings.webhooks.errors.notFound") }

    await writeWebhookAudit(
      context,
      active ? "webhook.endpoint.enabled" : "webhook.endpoint.disabled",
      row.id,
      { host: new URL(row.url).host }
    )

    revalidatePath(webhooksPath)

    return { data: { endpoint: toWebhookEndpointListItem(row) } }
  } catch (error) {
    return handleWebhookError(error, "setWebhookEndpointActive", context.userId, "updateFailed")
  }
}

export async function deleteWebhookEndpoint(input: unknown): Promise<WebhookEndpointActionResult> {
  const gate = await requireWebhookWrite()

  if ("error" in gate) return gate

  const parsed = webhookEndpointIdSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const [row] = await database
      .delete(webhookEndpoints)
      .where(eq(webhookEndpoints.id, parsed.data.endpointId))
      .returning({ id: webhookEndpoints.id, url: webhookEndpoints.url })

    if (!row) return { error: t("settings.webhooks.errors.notFound") }

    await writeWebhookAudit(context, "webhook.endpoint.deleted", row.id, {
      host: new URL(row.url).host
    })

    revalidatePath(webhooksPath)

    return { data: { endpointId: row.id } }
  } catch (error) {
    return handleWebhookError(error, "deleteWebhookEndpoint", context.userId, "deleteFailed")
  }
}

// Queued like any other delivery, through the same job and the same SSRF-defended fetcher, so a
// passing test means a real event would arrive too. It needs an active endpoint for that reason: a
// test that bypassed the switch would prove nothing about the live path.
export async function sendWebhookTest(input: unknown): Promise<WebhookEndpointActionResult> {
  const gate = await requireWebhookWrite()

  if ("error" in gate) return gate

  const parsed = webhookEndpointIdSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const [row] = await database
      .select({ id: webhookEndpoints.id, active: webhookEndpoints.active })
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.id, parsed.data.endpointId))
      .limit(1)

    if (!row) return { error: t("settings.webhooks.errors.notFound") }

    if (!row.active) return { error: t("settings.webhooks.errors.inactive") }

    await enqueueWebhookTestDelivery(row.id)

    revalidatePath(webhooksPath)

    return { data: { endpointId: row.id } }
  } catch (error) {
    return handleWebhookError(error, "sendWebhookTest", context.userId, "testFailed")
  }
}

// Owner-only: an endpoint sends business events to a URL outside the instance, which is a transmit
// decision on the same footing as sending a document.
async function requireWebhookWrite(): Promise<WebhookWriteGate> {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({ headers: requestHeaders })

  if (!session) return { error: t("errors.unauthorized") }

  const role = await getCurrentRole({ headers: requestHeaders, userId: session.user.id })

  if (role !== "owner") return { error: t("errors.forbidden") }

  return {
    context: {
      userId: session.user.id,
      role,
      ipAddress: getIpAddress(requestHeaders),
      userAgent: requestHeaders.get("user-agent")
    }
  }
}

async function writeWebhookAudit(
  context: WebhookWriteContext,
  event: WebhookAuditEvent,
  endpointId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  await writeAudit(event, {
    actorUserId: context.userId,
    actorRole: context.role,
    targetEntityType: "webhook_endpoint",
    targetEntityId: endpointId,
    metadata,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent
  })
}

function getUrlRefusalMessage(reason: WebhookUrlRefusal): string {
  if (reason === "too_long") return t("settings.webhooks.validation.urlTooLong")
  if (reason === "scheme") return t("settings.webhooks.validation.urlScheme")
  if (reason === "credentials") return t("settings.webhooks.validation.urlCredentials")
  if (reason === "address") return t("settings.webhooks.validation.urlAddress")

  return t("settings.webhooks.validation.urlInvalid")
}

function handleWebhookError(
  error: unknown,
  action: string,
  userId: string,
  fallback: "createFailed" | "updateFailed" | "deleteFailed" | "testFailed"
): { error: string } {
  logger.error({ action, userId, err: error }, "Webhook settings action failed")

  return { error: t(`settings.webhooks.errors.${fallback}`) }
}
