import { NextResponse } from "next/server"

import { checkDatabaseConnectivity } from "@/features/health"

import { logger } from "@/lib/logger"

export const dynamic = "force-dynamic"

const headers = {
  "Cache-Control": "no-store"
}

export async function GET(): Promise<Response> {
  const result = await checkDatabaseConnectivity()

  if (result.ok) {
    return NextResponse.json({ status: "ok" }, { headers })
  }

  logger.error(
    { action: "api.health.GET", check: "database", err: result.error },
    "Public health check failed"
  )

  return NextResponse.json({ status: "degraded", reason: result.reason }, { status: 503, headers })
}
