import Stripe from "stripe"

import { t } from "@/lib/i18n/server"

import { writeAudit } from "@/lib/audit"

import { logger } from "@/lib/logger"

import { env } from "@/lib/config/env"

import { database } from "@/database"

import { buildInvoiceCheckoutIdempotencyKey, decideInvoiceCheckout } from "./services"

// The producer half of the card path, and the only thing in Remit that creates a Stripe Checkout
// Session. It sits beside `stripeWebhook.ts` deliberately: the two halves are joined by one metadata
// key, and keeping them in one directory is what stops that contract drifting apart.
//
// The invoice arrives as an argument rather than being resolved here. `features/invoices` already
// depends on this feature to record a settlement, so reaching back into it for the public read would
// close an import cycle; `features/invoices/publicCheckout.ts` owns the resolution and this file owns
// the money.

export type InvoiceCheckoutTarget = {
  id: string
  number: string
  status: "draft" | "sent" | "paid"
  currency: string
  totalCents: number
  amountPaidCents: number
}

export type StartInvoiceCheckoutRequest = {
  invoice: InvoiceCheckoutTarget
  token: string
  ipAddress: string | null
  userAgent: string | null
}

export type StartInvoiceCheckoutResult = { data: { url: string } } | { error: string }

const STRIPE_API_VERSION = "2026-05-27.dahlia"
// A client is waiting on a button while this runs, so it fails fast rather than holding the request
// open through the SDK's default patience. The webhook path keeps that patience; nobody is watching
// it.
const STRIPE_CHECKOUT_TIMEOUT_MS = 15_000

export async function startInvoiceCheckout({
  invoice,
  token,
  ipAddress,
  userAgent
}: StartInvoiceCheckoutRequest): Promise<StartInvoiceCheckoutResult> {
  const configuration = await getStripeConfiguration()

  const decision = decideInvoiceCheckout({
    status: invoice.status,
    totalCents: invoice.totalCents,
    amountPaidCents: invoice.amountPaidCents,
    stripeConfigured: configuration !== null
  })

  // Every refusal here returns the message an unknown token returns. Splitting "this invoice is a
  // draft" from "this instance has no Stripe" from "no such token" would hand an anonymous caller an
  // oracle for all three, and the page's own read already answers with one indivisible unavailable
  // state.
  if (!decision.payable || !configuration) {
    logger.info(
      {
        action: "startInvoiceCheckout",
        invoiceId: invoice.id,
        reason: decision.payable ? "not_configured" : decision.reason
      },
      "Invoice checkout refused"
    )

    return { error: t("invoices.public.payment.unavailable") }
  }

  const session = await createCheckoutSession({
    secretKey: configuration.secretKey,
    token,
    invoice,
    amountCents: decision.amountCents
  })

  if (!session) return { error: t("invoices.public.payment.startFailed") }

  await writeAudit("payment.stripe.checkout_started", {
    targetEntityType: "invoice",
    targetEntityId: invoice.id,
    metadata: {
      checkoutSessionId: session.id,
      amountCents: decision.amountCents,
      currency: invoice.currency
    },
    ipAddress,
    userAgent
  })

  return { data: { url: session.url } }
}

type CheckoutSessionInput = {
  secretKey: string
  token: string
  invoice: InvoiceCheckoutTarget
  amountCents: number
}

// The whole trust boundary of this stage is the amount and the metadata key set below. Everything
// else about the session is presentation.
async function createCheckoutSession({
  secretKey,
  token,
  invoice,
  amountCents
}: CheckoutSessionInput): Promise<{ id: string; url: string } | null> {
  const stripe = new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
    maxNetworkRetries: 1,
    timeout: STRIPE_CHECKOUT_TIMEOUT_MS
  })

  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: invoice.currency.toLowerCase(),
              unit_amount: amountCents,
              product_data: {
                name: t("invoices.public.payment.lineItemName", { number: invoice.number })
              }
            }
          }
        ],
        // Metadata set at the session's own top level stays on the session. The receiver in
        // `stripeWebhook.ts` reads `metadata.remit_invoice_id` off the *payment intent* that
        // `payment_intent.succeeded` carries, and `payment_intent_data` is the only parameter here
        // that reaches it — a session carrying the id only in session metadata would complete,
        // charge the client, and be acknowledged by the receiver as somebody else's intent.
        //
        // The value is the invoice's own uuid and never its public token: a token can be rotated or
        // revoked while a session is open, and the money that session collects is still owed on the
        // same invoice.
        payment_intent_data: { metadata: { remit_invoice_id: invoice.id } },
        success_url: `${env.NEXT_PUBLIC_APP_URL}/i/${token}/paid`,
        cancel_url: `${env.NEXT_PUBLIC_APP_URL}/i/${token}`
      },
      { idempotencyKey: buildInvoiceCheckoutIdempotencyKey(invoice.id, amountCents) }
    )

    if (!session.url) return null

    return { id: session.id, url: session.url }
  } catch (error) {
    logger.error(
      { action: "startInvoiceCheckout", invoiceId: invoice.id, err: error },
      "Stripe checkout session could not be created"
    )

    return null
  }
}

// The same pair, read the same way, as `stripeWebhook.ts`'s own configuration read. A secret key
// without a webhook secret is not a configured instance: it can take a client's money and has
// nothing that records it.
async function getStripeConfiguration(): Promise<{ secretKey: string } | null> {
  const row = await database.query.settings.findFirst({
    columns: { stripeSecretKey: true, stripeWebhookSecret: true }
  })

  if (!row?.stripeSecretKey || !row.stripeWebhookSecret) return null

  return { secretKey: row.stripeSecretKey }
}
