import { NextResponse } from "next/server"

import { t } from "@/lib/i18n/server"

import { logger } from "@/lib/logger"

import { env } from "@/lib/config/env"

import { isMetricsCredential, METRICS_RESPONSE_HEADERS } from "./admission"
import { collectMetrics } from "./collectMetrics"
import { EXPOSITION_CONTENT_TYPE, formatExposition } from "./exposition"

// Reached through `proxy.ts`'s rewrite of a scrape `admitMetricsScrape` admitted, which owns the
// rate limit, or by a request addressed to `/api/metrics/scrape` itself. The credential is checked
// again here so the route never serves metrics on the proxy's word alone: a direct request without
// the token is refused like any other, and only the path a scraper is told to use is
// indistinguishable from one with no route.
export async function handleMetricsRequest(request: Request): Promise<Response> {
  if (!isMetricsCredential(request.headers.get("authorization"), env.REMIT_METRICS_TOKEN)) {
    return jsonResponse({ error: t("errors.notFound") }, 404)
  }

  try {
    const body = formatExposition(await collectMetrics())

    return new NextResponse(body, {
      status: 200,
      headers: { ...METRICS_RESPONSE_HEADERS, "Content-Type": EXPOSITION_CONTENT_TYPE }
    })
  } catch (error) {
    logger.error({ action: "api.metrics.GET", err: error }, "Metrics exposition failed")

    return jsonResponse({ error: t("errors.somethingWentWrong") }, 500)
  }
}

function jsonResponse(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, { status, headers: METRICS_RESPONSE_HEADERS })
}
