import { type NextRequest } from "next/server"

import { handleMetricsRequest } from "@/lib/metrics"

export const dynamic = "force-dynamic"

// Scrapers address `/api/metrics`, and `proxy.ts` rewrites an admitted scrape here. Nothing serves
// `/api/metrics` itself: a request without the token falls through to that path's own not-found
// answer, the same one any path with no route gets (`lib/metrics/admission.ts`).
export async function GET(request: NextRequest): Promise<Response> {
  return handleMetricsRequest(request)
}
