import { NextResponse } from "next/server"

import { z } from "zod"

import { t } from "@/lib/i18n/server"

import { writeRateLimitTripAudit } from "@/lib/audit"

import { getIpAddress } from "@/lib/utils"

import { matchesPublicToken } from "@/lib/publicToken"
import { rateLimitInstance } from "@/lib/rateLimit"

export const METRICS_ROUTE_PATH = "/api/metrics"
export const METRICS_SCRAPE_ROUTE_PATH = "/api/metrics/scrape"

// Rate limit for GET /api/metrics, declared at the top of the module per `.agents/rules/security.md`.
// A scraper polls every 15 seconds by convention, four requests a minute; thirty leaves room for a
// 5-second interval and a highly available pair of scrapers behind one address. It is not what
// protects the token — 256 bits is not brute-forced at any rate — but a refusal is cheap and a
// successful scrape reads Redis, so the limit caps how often anyone can make the instance do that.
const METRICS_RATE_LIMIT_MAX = 30
const METRICS_RATE_LIMIT_WINDOW_MS = 60 * 1000
const METRICS_RATE_LIMIT_KEY = "api.metrics"

const bearerCredentialSchema = z
  .string()
  .regex(/^Bearer \S+$/)
  .transform((value) => value.slice("Bearer ".length))

export const METRICS_RESPONSE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow"
}

export type MetricsAdmission =
  | { outcome: "admitted" }
  | { outcome: "refused" }
  | { outcome: "limited"; response: NextResponse }

// Decided in `proxy.ts`, ahead of the session state machine, because a refused scrape must be
// answered exactly as a path with no route is: a redirect to sign in for an anonymous caller, the
// framework's not-found page for a signed-in one. A route handler can only answer as a route that
// exists, so none serves `METRICS_ROUTE_PATH`, and the proxy rewrites an admitted scrape to the one
// at `METRICS_SCRAPE_ROUTE_PATH`.
//
// The limit comes first and counts every request to the path, so a caller probing it meets the same
// limit whether metrics are enabled or not and cannot learn which from the moment a 429 starts.
//
// The environment is imported here, on first use, rather than at the top of the module, as
// `lib/rateLimit/connection.ts` does for the same reason: `proxy.ts` imports this module, and
// `lib/config/env.ts` exits the process when validation fails, so a static import would make
// importing the proxy — which its own tests do — validate the whole deployment environment first.
export async function admitMetricsScrape(request: Request): Promise<MetricsAdmission> {
  const ipAddress = getIpAddress(request.headers)

  const rateLimitTrip = {
    key: `${METRICS_RATE_LIMIT_KEY}:${ipAddress ?? "unknown"}`,
    windowMs: METRICS_RATE_LIMIT_WINDOW_MS
  }
  const rateLimit = await rateLimitInstance.consume(
    rateLimitTrip.key,
    METRICS_RATE_LIMIT_MAX,
    rateLimitTrip.windowMs
  )

  if (!rateLimit.allowed) {
    await writeRateLimitTripAudit(rateLimitTrip, {
      ipAddress,
      userAgent: request.headers.get("user-agent"),
      metadata: { route: METRICS_ROUTE_PATH }
    })

    return {
      outcome: "limited",
      response: NextResponse.json(
        { error: t("errors.tooManyRequests") },
        { status: 429, headers: METRICS_RESPONSE_HEADERS }
      )
    }
  }

  const { env } = await import("@/lib/config/env")

  return isMetricsCredential(request.headers.get("authorization"), env.REMIT_METRICS_TOKEN)
    ? { outcome: "admitted" }
    : { outcome: "refused" }
}

// Unset means unavailable, never public (ADR-0018), and every refusal — no token configured, no
// credential, a wrong one — is the same refusal: whether metrics are enabled on an instance is not
// something a caller without the token may learn.
//
// The comparison is constant-time through `matchesPublicToken`, never `===`, which would return as
// soon as the first byte differs and let a caller recover the token one byte at a time. The disabled
// case skips the compare, which costs a microsecond against a network round trip.
export function isMetricsCredential(
  authorization: string | null,
  token: string | undefined
): boolean {
  const credential = bearerCredentialSchema.safeParse(authorization)

  return !!token && credential.success && matchesPublicToken(credential.data, token)
}
