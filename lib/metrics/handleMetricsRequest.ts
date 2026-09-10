import { NextResponse } from "next/server"

import { z } from "zod"

import { t } from "@/lib/i18n/server"

import { writeAudit } from "@/lib/audit"

import { logger } from "@/lib/logger"

import { getIpAddress } from "@/lib/utils"

import { env } from "@/lib/config/env"
import { matchesPublicToken } from "@/lib/publicToken"
import { rateLimitInstance } from "@/lib/rateLimit"

import { collectMetrics } from "./collectMetrics"
import { EXPOSITION_CONTENT_TYPE, formatExposition } from "./exposition"

// Rate limit for GET /api/metrics, declared at the top of the module per `.agents/rules/security.md`.
// `proxy.ts` applies no per-IP backstop to `/api/*`, so this is the only limit the route has. A
// scraper polls every 15 seconds by convention, four requests a minute; thirty leaves room for a
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

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow"
}

export async function handleMetricsRequest(request: Request): Promise<Response> {
  const ipAddress = getIpAddress(request.headers)

  // Ahead of the configuration check, so a caller probing the endpoint meets the same limit whether
  // metrics are enabled or not and cannot learn which from the moment a 429 starts.
  const rateLimit = await rateLimitInstance.consume(
    `${METRICS_RATE_LIMIT_KEY}:${ipAddress ?? "unknown"}`,
    METRICS_RATE_LIMIT_MAX,
    METRICS_RATE_LIMIT_WINDOW_MS
  )

  if (!rateLimit.allowed) {
    await writeAudit("auth.rate_limit.tripped", {
      ipAddress,
      userAgent: request.headers.get("user-agent"),
      metadata: { route: "/api/metrics" }
    })

    return jsonResponse({ error: t("errors.tooManyRequests") }, 429)
  }

  const credential = bearerCredentialSchema.safeParse(request.headers.get("authorization"))

  // Unset means unavailable, never public (ADR-0018), and every refusal — no token configured, no
  // credential, a wrong one — returns this one response. A 503 for the disabled case would announce
  // that the instance has metrics switched off; a 401 for a wrong token would confirm the feature is
  // on and worth guessing at. The route's existence is no secret in an open-source codebase, but
  // whether it is enabled on this instance is.
  //
  // The comparison is constant-time through `matchesPublicToken`, never `===`, which would return
  // as soon as the first byte differs and let a caller recover the token one byte at a time. The
  // disabled case skips the compare, which costs a microsecond against a network round trip.
  if (
    !env.REMIT_METRICS_TOKEN ||
    !credential.success ||
    !matchesPublicToken(credential.data, env.REMIT_METRICS_TOKEN)
  ) {
    return jsonResponse({ error: t("errors.notFound") }, 404)
  }

  try {
    const body = formatExposition(await collectMetrics())

    return new NextResponse(body, {
      status: 200,
      headers: { ...RESPONSE_HEADERS, "Content-Type": EXPOSITION_CONTENT_TYPE }
    })
  } catch (error) {
    logger.error({ action: "api.metrics.GET", err: error }, "Metrics exposition failed")

    return jsonResponse({ error: t("errors.somethingWentWrong") }, 500)
  }
}

function jsonResponse(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, { status, headers: RESPONSE_HEADERS })
}
