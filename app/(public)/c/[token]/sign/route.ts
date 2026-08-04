import { headers } from "next/headers"

import { NextResponse, type NextRequest } from "next/server"

import { t } from "@/lib/i18n/server"

import { writeAudit } from "@/lib/audit"

import { getIpAddress } from "@/lib/utils"

import { rateLimitInstance } from "@/lib/rateLimit"

import { signPublicContract } from "@/features/contracts/server"

// Rate limit for POST /c/[token]/sign, declared at the top of the module per
// `.agents/rules/security.md`. Signing is terminal — a contract can be signed exactly once — so the
// bucket only has to leave room for a signer who mistypes their own name or address and resubmits,
// while closing the loop of walking tokens and probing which ones are still signable. Keyed on IP
// alone rather than IP plus token, because a token-scoped bucket resets by moving to the next
// token, which is precisely the attack it would have to stop.
const CONTRACT_SIGN_RATE_LIMIT_MAX = 5
const CONTRACT_SIGN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const CONTRACT_SIGN_RATE_LIMIT_KEY = "contract.sign"

export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
): Promise<Response> {
  const { token } = await params

  const requestHeaders = await headers()

  const ipAddress = getIpAddress(requestHeaders)
  const userAgent = requestHeaders.get("user-agent")

  const rateLimit = await rateLimitInstance.consume(
    `${CONTRACT_SIGN_RATE_LIMIT_KEY}:${ipAddress ?? "unknown"}`,
    CONTRACT_SIGN_RATE_LIMIT_MAX,
    CONTRACT_SIGN_RATE_LIMIT_WINDOW_MS
  )

  if (!rateLimit.allowed) {
    await writeAudit("auth.rate_limit.tripped", {
      ipAddress,
      userAgent,
      metadata: { route: "/c/[token]/sign" }
    })

    return noindexJson({ error: t("contracts.public.errors.rateLimited") }, 429)
  }

  const result = await signPublicContract(await readJsonBody(request), {
    token,
    ipAddress,
    userAgent
  })

  // One status for every failure. A 404 for an unknown token and a 409 for a contract that is no
  // longer signable would tell a caller which of the two it hit, and the whole point of the uniform
  // "unavailable" result is that they are indistinguishable.
  if ("error" in result) return noindexJson({ error: result.error }, 400)

  return noindexJson({ status: result.data.status, signedAt: result.data.signedAt }, 200)
}

// `proxy.ts` already stamps `X-Robots-Tag` on everything under `/c/`, and this sets it again at the
// handler: the proxy matcher is one edit away from not covering a path, and a public token response
// that reaches a crawler is not recoverable once indexed. The twin of `noindexJson` in
// `app/(public)/p/[token]/otp/publicOtpRoute.ts`, which must keep setting the same header.
function noindexJson(body: unknown, status: number): NextResponse {
  const response = NextResponse.json(body, { status })

  response.headers.set("X-Robots-Tag", "noindex, nofollow")

  return response
}

// A malformed body becomes `null` rather than a thrown parse error, so it falls through to the same
// Zod rejection as a well-formed body with the wrong fields.
async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}
