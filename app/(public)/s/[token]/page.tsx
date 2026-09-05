import { headers } from "next/headers"

import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { writeAudit } from "@/lib/audit"

import { getIpAddress } from "@/lib/utils"

import { rateLimitInstance } from "@/lib/rateLimit"

import { PublicClientPortalPage, PublicClientPortalUnavailable } from "@/features/clients"
import { getClientPortal } from "@/features/clients/server"

// Rate limit for `/s/[token]`, declared at the top of the module per `.agents/rules/security.md`, and
// tighter than the 60-per-minute backstop `proxy.ts` applies to every public token route. One guess
// against this surface is worth more than a guess against `/i/`, `/p/` or `/c/`: those resolve to a
// single document, this one resolves to a client's whole relationship with the business, and the
// portal token outlives every document token because it is a standing door rather than a covering
// note. Thirty in five minutes is far more than a person reading their own statement needs and cuts
// the enumeration rate against the highest-value token in the instance.
//
// Keyed on IP alone rather than IP plus token, because a token-scoped bucket resets by moving to the
// next token, which is precisely the attack it would have to stop.
const CLIENT_PORTAL_RATE_LIMIT_MAX = 30
const CLIENT_PORTAL_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000
const CLIENT_PORTAL_RATE_LIMIT_KEY = "client.portal"

// `robots` renders the `<meta name="robots" content="noindex, nofollow">` the public-token rule
// requires in the page head; `proxy.ts` sets the matching `X-Robots-Tag` on the response. The title
// is deliberately generic, and more strictly so than on the document routes: a client's business name
// in a browser tab or a shared screenshot names the freelancer's customer, not just a document.
export const metadata: Metadata = {
  title: t("clients.public.metadataTitle"),
  robots: { index: false, follow: false }
}

// Never cached: the page prints what is still owed across every invoice, and a payment recorded in
// the dashboard, a rotated document link or a revoked portal all change it at any moment.
export const dynamic = "force-dynamic"

type PublicClientPortalRouteProps = {
  params: Promise<{ token: string }>
}

const PublicClientPortalRoute = async ({ params }: PublicClientPortalRouteProps) => {
  const { token } = await params

  const requestHeaders = await headers()

  const ipAddress = getIpAddress(requestHeaders)

  const rateLimit = await rateLimitInstance.consume(
    `${CLIENT_PORTAL_RATE_LIMIT_KEY}:${ipAddress ?? "unknown"}`,
    CLIENT_PORTAL_RATE_LIMIT_MAX,
    CLIENT_PORTAL_RATE_LIMIT_WINDOW_MS
  )

  // A tripped limit renders the same panel a bad token does. Telling the caller they were throttled
  // would confirm that their previous requests were being processed, which is the one thing a
  // token-walker learns nothing else from here.
  if (!rateLimit.allowed) {
    await writeAudit("auth.rate_limit.tripped", {
      ipAddress,
      userAgent: requestHeaders.get("user-agent"),
      metadata: { route: "/s/[token]" }
    })

    return <PublicClientPortalUnavailable />
  }

  const portal = await getClientPortal({ token })

  if (!portal) return <PublicClientPortalUnavailable />

  return <PublicClientPortalPage portal={portal} />
}

export default PublicClientPortalRoute
