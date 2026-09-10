import { type NextRequest } from "next/server"

import { handleMetricsRequest } from "@/lib/metrics"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest): Promise<Response> {
  return handleMetricsRequest(request)
}
