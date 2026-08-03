import Stripe from "stripe"

import { z } from "zod"

import { writeAudit } from "@/lib/audit"

import { logger } from "@/lib/logger"

import { database } from "@/database"

import { emitInvoiceSettled, emitPaymentReceived } from "./events"
import { revalidatePaymentPaths } from "./mutationContext"
import { recordStripePaymentWrite, type PaymentRejectionReason } from "./paymentWrites"

// The receiver behind `POST /api/webhooks/stripe`. It sits here rather than in the route so the
// route stays the thin HTTP shell `routes.md` asks for, and so the same logic is reachable from a
// test without a `Request`.
//
// Nothing is written before `constructEventAsync` returns. That call is the entire trust boundary:
// the request body is attacker-controlled until the signature over it verifies against
// `settings.stripe_webhook_secret`.

export type StripeWebhookOutcome =
  | { status: "recorded"; paymentId: string; invoiceId: string; settled: boolean }
  | { status: "duplicate"; paymentId: string }
  | { status: "ignored"; reason: "unhandled_event" | "unlinked_intent" }
  | { status: "rejected"; reason: PaymentRejectionReason }

export type StripeWebhookFailure = "not_configured" | "invalid_signature"

export type StripeWebhookResult = { data: StripeWebhookOutcome } | { error: StripeWebhookFailure }

export type StripeWebhookRequest = {
  payload: string
  signature: string | null
  ipAddress: string | null
  userAgent: string | null
}

const STRIPE_API_VERSION = "2026-05-27.dahlia"

// The contract with whatever starts a Checkout Session or Payment Intent for a Remit invoice: the
// invoice id travels in the intent's metadata under this key. It is namespaced because a
// self-hoster's Stripe account may serve other integrations whose intents reach this same endpoint;
// an intent without the key is somebody else's and is acknowledged without a write.
const stripePaymentIntentSchema = z.object({
  id: z.string().trim().min(1),
  amount_received: z.number().int().positive(),
  currency: z.string().trim().length(3),
  created: z.number().int().positive(),
  metadata: z.object({ remit_invoice_id: z.uuid() })
})

export async function handleStripeWebhook(
  request: StripeWebhookRequest
): Promise<StripeWebhookResult> {
  if (!request.signature) return { error: "invalid_signature" }

  const configuration = await getStripeConfiguration()

  if (!configuration) return { error: "not_configured" }

  const event = await verifyStripeEvent(request.payload, request.signature, configuration)

  if (!event) {
    await writeAudit("payment.stripe.signature_rejected", {
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      metadata: { route: "/api/webhooks/stripe" }
    })

    return { error: "invalid_signature" }
  }

  if (event.type !== "payment_intent.succeeded") {
    return { data: { status: "ignored", reason: "unhandled_event" } }
  }

  const parsed = stripePaymentIntentSchema.safeParse(event.data.object)

  if (!parsed.success) return { data: { status: "ignored", reason: "unlinked_intent" } }

  const invoiceId = parsed.data.metadata.remit_invoice_id
  const result = await recordStripePaymentWrite({
    invoiceId,
    amountCents: parsed.data.amount_received,
    currency: parsed.data.currency.toUpperCase(),
    // Stripe stamps `created` in whole seconds since the epoch.
    paidAt: new Date(parsed.data.created * 1000),
    stripePaymentIntentId: parsed.data.id
  })

  if (result.status === "duplicate") {
    return { data: { status: "duplicate", paymentId: result.paymentId } }
  }

  // A verified event Remit refuses is worth a permanent record: it means Stripe moved money that the
  // aggregate could not accept, and somebody has to reconcile it by hand.
  if (result.status === "rejected") {
    logger.error(
      { action: "handleStripeWebhook", invoiceId, reason: result.reason },
      "Stripe payment could not be recorded"
    )

    await writeAudit("payment.stripe.rejected", {
      targetEntityType: "invoice",
      targetEntityId: invoiceId,
      metadata: {
        reason: result.reason,
        paymentIntentId: parsed.data.id,
        amountCents: parsed.data.amount_received
      },
      ipAddress: request.ipAddress,
      userAgent: request.userAgent
    })

    return { data: { status: "rejected", reason: result.reason } }
  }

  const { payment } = result

  await writeAudit("payment.stripe.recorded", {
    targetEntityType: "payment",
    targetEntityId: payment.paymentId,
    metadata: {
      invoiceId: payment.invoiceId,
      paymentIntentId: parsed.data.id,
      amountCents: payment.amountCents,
      amountPaidCents: payment.amountPaidCents,
      settled: payment.settled
    },
    ipAddress: request.ipAddress,
    userAgent: request.userAgent
  })
  await emitPaymentReceived({
    paymentId: payment.paymentId,
    invoiceId: payment.invoiceId,
    userId: null
  })

  if (payment.settled) {
    await emitInvoiceSettled({ invoiceId: payment.invoiceId, userId: null })
  }

  revalidatePaymentPaths({
    id: payment.invoiceId,
    projectId: payment.projectId,
    clientId: payment.clientId
  })

  return {
    data: {
      status: "recorded",
      paymentId: payment.paymentId,
      invoiceId: payment.invoiceId,
      settled: payment.settled
    }
  }
}

// Both secrets are read as one unit. The webhook secret is what verifies the signature; the API key
// is only there because the SDK client requires one to exist, and neither value leaves this
// function — a `null` return is the whole story a caller gets.
async function getStripeConfiguration(): Promise<{
  secretKey: string
  webhookSecret: string
} | null> {
  const row = await database.query.settings.findFirst({
    columns: { stripeSecretKey: true, stripeWebhookSecret: true }
  })

  if (!row?.stripeSecretKey || !row.stripeWebhookSecret) return null

  return { secretKey: row.stripeSecretKey, webhookSecret: row.stripeWebhookSecret }
}

// The thrown error is dropped rather than logged: its message quotes the signature header and the
// payload prefix it failed against, and a forged request is exactly the case that reaches it.
async function verifyStripeEvent(
  payload: string,
  signature: string,
  configuration: { secretKey: string; webhookSecret: string }
): Promise<Stripe.Event | null> {
  const stripe = new Stripe(configuration.secretKey, { apiVersion: STRIPE_API_VERSION })

  try {
    return await stripe.webhooks.constructEventAsync(
      payload,
      signature,
      configuration.webhookSecret
    )
  } catch {
    return null
  }
}
