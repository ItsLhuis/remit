import { NextResponse } from "next/server"

import { logger } from "@/lib/logger"

import { checkDatabaseConnectivity } from "@/features/health/server"

import pkg from "@/package.json"

export const dynamic = "force-dynamic"

const headers = {
  "Cache-Control": "no-store"
}

export async function GET(): Promise<Response> {
  const result = await checkDatabaseConnectivity()

  if (result.ok) {
    return NextResponse.json({ ok: true, version: pkg.version }, { headers })
  }

  logger.error(
    { action: "api.health.GET", check: "database", reason: result.reason },
    "Public health check failed"
  )

  return NextResponse.json({ ok: false, reason: result.reason }, { status: 503, headers })
}
