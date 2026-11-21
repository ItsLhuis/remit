import { headers } from "next/headers"

import { type NextRequest } from "next/server"

import { t } from "@/lib/i18n/server"

import { writeRateLimitTripAudit } from "@/lib/audit"

import { getIpAddress, noindexJson } from "@/lib/utils"

import { rateLimitInstance } from "@/lib/rateLimit"

import { verifyProposalOtp } from "@/features/proposals/server"

import { readJsonBody } from "../publicOtpRoute"

// Rate limit for POST /p/[token]/otp/verify, declared at the top of the module per
// `.agents/rules/security.md`. It sits above the request limit because a client legitimately
// retypes a code, and below what a guesser needs: `proposal_otps.attempts` already burns a code
// after five wrong guesses, so this bucket only has to stop the outer loop of requesting a fresh
// code and spending its five, over and over. Keyed on IP alone for the same reason as the request
// route — a token-scoped bucket resets by moving to the next token.
const OTP_VERIFY_RATE_LIMIT_MAX = 10
const OTP_VERIFY_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const OTP_VERIFY_RATE_LIMIT_KEY = "proposal.otp.verify"

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
    key: `${OTP_VERIFY_RATE_LIMIT_KEY}:${ipAddress ?? "unknown"}`,
    windowMs: OTP_VERIFY_RATE_LIMIT_WINDOW_MS
  }
  const rateLimit = await rateLimitInstance.consume(
    rateLimitTrip.key,
    OTP_VERIFY_RATE_LIMIT_MAX,
    rateLimitTrip.windowMs
  )

  if (!rateLimit.allowed) {
    await writeRateLimitTripAudit(rateLimitTrip, {
      ipAddress,
      userAgent,
      metadata: { route: "/p/[token]/otp/verify" }
    })

    return noindexJson({ error: t("proposals.public.errors.rateLimited") }, 429)
  }

  const result = await verifyProposalOtp(await readJsonBody(request), {
    token,
    ipAddress,
    userAgent
  })

  // One status for every failure, for the reason given in the sibling request route.
  if ("error" in result) return noindexJson({ error: result.error }, 400)

  return noindexJson(result.data, 200)
}
