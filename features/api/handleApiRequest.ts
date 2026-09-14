import { NextResponse } from "next/server"

import { t } from "@/lib/i18n/server"

import { writeAudit } from "@/lib/audit"

import { logger } from "@/lib/logger"

import { getIpAddress } from "@/lib/utils"

import { rateLimitInstance } from "@/lib/rateLimit"

import { authenticateApiRequest, type ApiRequestContext } from "./authenticate"
import { type ApiOperation } from "./operations"
import { type ApiListResult } from "./resources"
import { type ApiErrorBody, type ApiErrorCode } from "./responseSchemas"
import { apiListParamsSchema, apiResourceIdSchema, type ApiListParams } from "./schemas"

// Rate limits for every `/api/v1/*` route, declared at the top of the module per
// `.agents/rules/security.md`. The per-IP backstop runs before authentication, so a caller without
// a valid token still meets a limit and cannot make the instance hash and look up credentials
// without bound. Once a token is known the limit that matters keys on the token rather than the
// address: one integration behind a shared egress address must not starve another, and one token
// must not escape its limit by rotating addresses.
const API_IP_RATE_LIMIT_MAX = 300
const API_TOKEN_RATE_LIMIT_MAX = 120
const API_RATE_LIMIT_WINDOW_MS = 60 * 1000

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow"
}

type ApiAdmission = { context: ApiRequestContext } | { response: NextResponse }

export async function handleApiListRequest<TItem>(
  request: Request,
  operation: ApiOperation,
  read: (params: ApiListParams) => Promise<ApiListResult<TItem>>
): Promise<Response> {
  const admission = await admitApiRequest(request, operation)

  if ("response" in admission) return admission.response

  const parsed = apiListParamsSchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams)
  )

  if (!parsed.success) return apiError("invalid_request", parsed.error.issues[0].message, 400)

  const { page, perPage } = parsed.data

  try {
    const result = await read(parsed.data)

    return apiJson(
      operation.response.parse({
        data: result.rows,
        pagination: { page, perPage, total: result.total }
      })
    )
  } catch (error) {
    return apiFailure(error, operation, admission.context)
  }
}

export async function handleApiItemRequest<TItem>(
  request: Request,
  id: string,
  operation: ApiOperation,
  read: (id: string) => Promise<TItem | null>
): Promise<Response> {
  const admission = await admitApiRequest(request, operation)

  if ("response" in admission) return admission.response

  const parsed = apiResourceIdSchema.safeParse({ id })

  // A malformed id is answered as a missing record rather than a bad request, the same way every
  // detail read in the application treats one: there is nothing at that address either way.
  if (!parsed.success) return apiError("not_found", t("errors.notFound"), 404)

  try {
    const item = await read(parsed.data.id)

    if (!item) return apiError("not_found", t("errors.notFound"), 404)

    return apiJson(operation.response.parse({ data: item }))
  } catch (error) {
    return apiFailure(error, operation, admission.context)
  }
}

export async function handleApiDocumentRequest(
  request: Request,
  operation: ApiOperation,
  build: () => unknown
): Promise<Response> {
  const admission = await admitApiRequest(request, operation)

  if ("response" in admission) return admission.response

  try {
    return apiJson(operation.response.parse(build()))
  } catch (error) {
    return apiFailure(error, operation, admission.context)
  }
}

async function admitApiRequest(request: Request, operation: ApiOperation): Promise<ApiAdmission> {
  const ipAddress = getIpAddress(request.headers)
  const userAgent = request.headers.get("user-agent")

  const addressLimit = await rateLimitInstance.consume(
    `api.v1.ip:${ipAddress ?? "unknown"}`,
    API_IP_RATE_LIMIT_MAX,
    API_RATE_LIMIT_WINDOW_MS
  )

  if (!addressLimit.allowed) {
    await writeAudit("auth.rate_limit.tripped", {
      ipAddress,
      userAgent,
      metadata: { route: operation.path }
    })

    return { response: apiError("rate_limited", t("errors.tooManyRequests"), 429) }
  }

  const authentication = await authenticateApiRequest(
    request.headers.get("authorization"),
    operation.resource,
    new Date()
  )

  if ("refused" in authentication) {
    return { response: apiError("unauthorized", t("api.errors.unauthorized"), 401) }
  }

  const { context } = authentication

  const tokenLimit = await rateLimitInstance.consume(
    `api.v1.token:${context.tokenId}`,
    API_TOKEN_RATE_LIMIT_MAX,
    API_RATE_LIMIT_WINDOW_MS
  )

  if (!tokenLimit.allowed) {
    await writeAudit("auth.rate_limit.tripped", {
      actorUserId: context.userId,
      actorRole: context.role,
      ipAddress,
      userAgent,
      metadata: { route: operation.path, apiTokenId: context.tokenId }
    })

    return { response: apiError("rate_limited", t("errors.tooManyRequests"), 429) }
  }

  return { context }
}

// The raw error is logged and never returned: it may be a driver error naming a table, or a Zod
// issue list describing a field a serialiser tried to publish.
function apiFailure(error: unknown, operation: ApiOperation, context: ApiRequestContext): Response {
  logger.error(
    { action: `api.${operation.operationId}`, apiTokenId: context.tokenId, err: error },
    "API request failed"
  )

  return apiError("internal_error", t("errors.somethingWentWrong"), 500)
}

function apiJson(body: unknown): NextResponse {
  return NextResponse.json(body, { status: 200, headers: RESPONSE_HEADERS })
}

function apiError(code: ApiErrorCode, message: string, status: number): NextResponse {
  const body: ApiErrorBody = { error: { code, message } }

  return NextResponse.json(body, { status, headers: RESPONSE_HEADERS })
}
