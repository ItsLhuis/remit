import { headers } from "next/headers"

import { NextResponse } from "next/server"

import { t } from "@/lib/i18n/server"

import { writeAudit } from "@/lib/audit"

import { getIpAddress } from "@/lib/utils"

import { rateLimitInstance } from "@/lib/rateLimit"

import { startPublicInvoiceCheckout } from "@/features/invoices/server"

// Rate limit for POST /i/[token]/pay, declared at the top of the module per
// `.agents/rules/security.md`. It is deliberately tighter than the 60-per-minute backstop `proxy.ts`
// applies to everything under `/i/`: every allowed call spends a Stripe API request against the
// operator's account, so an unthrottled endpoint is both a bill somebody else can run up and an
// enumeration oracle that costs an attacker nothing. Five sessions a quarter hour is far more than a
// client paying one invoice needs. Keyed on the caller's IP and never the token, because a
// token-scoped bucket resets by moving to the next token, which is the traffic the limit exists to
// stop.
const INVOICE_CHECKOUT_RATE_LIMIT_MAX = 5
const INVOICE_CHECKOUT_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const INVOICE_CHECKOUT_RATE_LIMIT_KEY = "invoice.checkout.start"

export const dynamic = "force-dynamic"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
): Promise<Response> {
  const { token } = await params

  const requestHeaders = await headers()

  const ipAddress = getIpAddress(requestHeaders)
  const userAgent = requestHeaders.get("user-agent")

  const rateLimit = await rateLimitInstance.consume(
    `${INVOICE_CHECKOUT_RATE_LIMIT_KEY}:${ipAddress ?? "unknown"}`,
    INVOICE_CHECKOUT_RATE_LIMIT_MAX,
    INVOICE_CHECKOUT_RATE_LIMIT_WINDOW_MS
  )

  if (!rateLimit.allowed) {
    await writeAudit("auth.rate_limit.tripped", {
      ipAddress,
      userAgent,
      metadata: { route: "/i/[token]/pay" }
    })

    return noindexJson({ error: t("invoices.public.payment.rateLimited") }, 429)
  }

  // The request body is not read at all, and that is the point: the amount, the currency and the
  // invoice identity are derived server-side from the token's own row. There is no field a client
  // could send that changes what they are charged.
  const result = await startPublicInvoiceCheckout({ token, ipAddress, userAgent })

  // One status for every failure. An unknown token, a draft invoice, a settled invoice and an
  // instance with no Stripe configured are indistinguishable from here; the distinction stays
  // server-side, in the logger and the audit trail.
  if ("error" in result) return noindexJson({ error: result.error }, 400)

  return noindexJson(result.data, 200)
}

// `proxy.ts` already stamps `X-Robots-Tag` on everything under `/i/`, and this sets it again at the
// handler: the proxy matcher is one edit away from not covering a path, and a public token response
// that reaches a crawler is not recoverable once indexed.
function noindexJson(body: unknown, status: number): NextResponse {
  const response = NextResponse.json(body, { status })

  response.headers.set("X-Robots-Tag", "noindex, nofollow")

  return response
}
