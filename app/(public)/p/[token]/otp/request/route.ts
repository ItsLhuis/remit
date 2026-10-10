import { headers } from "next/headers"

import { type NextRequest } from "next/server"

import { t } from "@/lib/i18n/server"

import { writeRateLimitTripAudit } from "@/lib/audit"

import { getIpAddress, noindexJson } from "@/lib/utils"

import { rateLimitInstance } from "@/lib/rateLimit"

import { requestProposalOtp } from "@/features/proposals/server"

import { readJsonBody } from "../publicOtpRoute"

// Rate limit for POST /p/[token]/otp/request, declared at the top of the module per
// `.agents/rules/security.md`. Five issued codes per quarter hour is generous for a client who
// mistypes their address and tight enough that the endpoint cannot be used to pump mail. The key is
// the caller's IP and never the token: a token-scoped bucket resets by moving to the next token,
// which is exactly the traffic the limit exists to stop.
const OTP_REQUEST_RATE_LIMIT_MAX = 5
const OTP_REQUEST_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const OTP_REQUEST_RATE_LIMIT_KEY = "proposal.otp.request"

export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
): Promise<Response> {
  const { token } = await params

  const requestHeaders = await headers()

  const ipAddress = getIpAddress(requestHeaders)
  const userAgent = requestHeaders.get("user-agent")

  const rateLimitTrip = {
    key: `${OTP_REQUEST_RATE_LIMIT_KEY}:${ipAddress ?? "unknown"}`,
    windowMs: OTP_REQUEST_RATE_LIMIT_WINDOW_MS
  }
  const rateLimit = await rateLimitInstance.consume(
    rateLimitTrip.key,
    OTP_REQUEST_RATE_LIMIT_MAX,
    rateLimitTrip.windowMs
  )

  if (!rateLimit.allowed) {
    await writeRateLimitTripAudit(rateLimitTrip, {
      ipAddress,
      userAgent,
      metadata: { route: "/p/[token]/otp/request" }
    })

    return noindexJson({ error: t("proposals.public.errors.rateLimited") }, 429)
  }

  const result = await requestProposalOtp(await readJsonBody(request), {
    token,
    ipAddress,
    userAgent
  })

  // Every failure shares one status. Splitting "no such proposal" from "already responded" from
  // "the write failed" into 404/409/500 would hand a caller a token-existence oracle that costs
  // nothing to probe; the distinction stays server-side, in the logger and the audit trail.
  if ("error" in result) return noindexJson({ error: result.error }, 400)

  return noindexJson(result.data, 200)
}
