import { headers } from "next/headers"

import { NextResponse, type NextRequest } from "next/server"

import { t } from "@/lib/i18n/server"

import { writeAudit } from "@/lib/audit"

import { getIpAddress } from "@/lib/utils"

import { rateLimitInstance } from "@/lib/rateLimit"

import { handleStripeWebhook } from "@/features/payments/server"

// Rate limit for POST /api/webhooks/stripe, declared at the top of the module per
// `.agents/rules/security.md`. The bucket is wide because the legitimate caller is Stripe replaying
// a backlog after an outage, and dropping those costs real reconciliation work; it is here to cap
// what an anonymous caller can make the instance decrypt and HMAC, not to shape Stripe's traffic.
// Keyed on IP alone: every Stripe delivery is unauthenticated until the signature verifies, so there
// is nothing else to key on at this point.
const STRIPE_WEBHOOK_RATE_LIMIT_MAX = 120
const STRIPE_WEBHOOK_RATE_LIMIT_WINDOW_MS = 60 * 1000
const STRIPE_WEBHOOK_RATE_LIMIT_KEY = "webhook.stripe"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest): Promise<Response> {
  const requestHeaders = await headers()

  const ipAddress = getIpAddress(requestHeaders)
  const userAgent = requestHeaders.get("user-agent")

  const rateLimit = await rateLimitInstance.consume(
    `${STRIPE_WEBHOOK_RATE_LIMIT_KEY}:${ipAddress ?? "unknown"}`,
    STRIPE_WEBHOOK_RATE_LIMIT_MAX,
    STRIPE_WEBHOOK_RATE_LIMIT_WINDOW_MS
  )

  if (!rateLimit.allowed) {
    await writeAudit("auth.rate_limit.tripped", {
      ipAddress,
      userAgent,
      metadata: { route: "/api/webhooks/stripe" }
    })

    return noindexJson({ error: t("payments.webhook.rateLimited") }, 429)
  }

  // The raw text, never `request.json()`: the signature is computed over the exact bytes Stripe
  // sent, so a parse-and-restringify round trip would break verification.
  const result = await handleStripeWebhook({
    payload: await request.text(),
    signature: requestHeaders.get("stripe-signature"),
    ipAddress,
    userAgent
  })

  if ("error" in result) {
    const status = result.error === "not_configured" ? 503 : 400

    return noindexJson({ error: t("payments.webhook.rejected") }, status)
  }

  // Everything past a verified signature is acknowledged, including an event Remit refused to
  // record. Stripe retries a non-2xx, and no number of retries will make an overpayment fit or an
  // unknown invoice appear — the refusal is already logged and audited by the receiver.
  return noindexJson({ received: true, status: result.data.status }, 200)
}

// The endpoint is public, so it carries the same `noindex` guarantee as the token routes
// (`security.md`). `proxy.ts` does not stamp `/api/`, which makes this the only place it is set.
function noindexJson(body: unknown, status: number): NextResponse {
  const response = NextResponse.json(body, { status })

  response.headers.set("X-Robots-Tag", "noindex, nofollow")

  return response
}
