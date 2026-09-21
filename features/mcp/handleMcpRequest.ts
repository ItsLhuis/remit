import { createMcpHandler, originValidationResponse } from "@modelcontextprotocol/server"

import { t } from "@/lib/i18n/server"

import { writeAudit } from "@/lib/audit"

import { logger } from "@/lib/logger"

import { getIpAddress } from "@/lib/utils"

import { env } from "@/lib/config/env"
import { rateLimitInstance } from "@/lib/rateLimit"

import { authenticateApiRequest } from "@/features/api/server"

import { buildMcpServer } from "./buildMcpServer"
import { MCP_ENDPOINT_PATH } from "./endpoint"
import { isMcpEnabled } from "./queries"
import { readCalledToolName } from "./services/requestEnvelope"
import { readMcpSession, toAuthInfo } from "./session"
import { findMcpTool } from "./tools"

// Rate limits for /api/mcp, declared at the top of the module per `.agents/rules/security.md`. The
// per-IP backstop matches the REST API's and runs before any database read. The per-token limit is
// half the REST API's: a model issues calls far faster than a person clicks, and each one is an
// aggregate read on the primary, so an assistant stuck in a loop must hit a wall long before the
// instance does.
const MCP_IP_RATE_LIMIT_MAX = 300
const MCP_TOKEN_RATE_LIMIT_MAX = 60
const MCP_RATE_LIMIT_WINDOW_MS = 60 * 1000

// A tool call is a few hundred bytes of arguments. The proxy already cuts a body off at ten
// megabytes; this refuses anything that could not be one long before the JSON parser sees it.
const MCP_MAX_BODY_LENGTH = 64 * 1024

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow"
}

// Built once and reused: the SDK constructs a fresh server per request from the factory, so nothing
// is shared between callers but the handler itself. 2025-era clients, which open with `initialize`,
// are served statelessly beside 2026-07-28 ones. Change subscriptions are refused outright — the
// tool list only changes when a token's scopes do, and an open stream would outlive both a
// revocation and the switch being turned off.
const mcpHandler = createMcpHandler(({ authInfo }) => buildMcpServer(readMcpSession(authInfo)), {
  legacy: "stateless",
  maxSubscriptions: 0,
  onerror: (error) => {
    logger.warn({ action: "mcp.request", err: error }, "MCP request rejected by the protocol layer")
  }
})

export async function handleMcpRequest(request: Request): Promise<Response> {
  // The specification's defence against DNS rebinding, which targets exactly a self-hosted instance
  // on a home or office network: a browser always names the page it runs on, so a page on any other
  // host is refused with the 403 the specification requires. MCP clients are not browsers and send
  // no Origin, which is why an absent header passes.
  const originRefusal = originValidationResponse(request, [new URL(env.REMIT_PUBLIC_URL).hostname])

  if (originRefusal) return originRefusal

  const ipAddress = getIpAddress(request.headers)
  const userAgent = request.headers.get("user-agent")

  const addressLimit = await rateLimitInstance.consume(
    `mcp.ip:${ipAddress ?? "unknown"}`,
    MCP_IP_RATE_LIMIT_MAX,
    MCP_RATE_LIMIT_WINDOW_MS
  )

  if (!addressLimit.allowed) {
    await writeAudit("auth.rate_limit.tripped", {
      ipAddress,
      userAgent,
      metadata: { route: MCP_ENDPOINT_PATH }
    })

    return jsonRpcError(t("errors.tooManyRequests"), 429)
  }

  // Off answers every request as though the route did not exist, valid token or not.
  if (!(await isMcpEnabled())) return jsonRpcError(t("errors.notFound"), 404)

  const body = await readJsonBody(request)

  if (body.tooLarge) return jsonRpcError(t("mcp.errors.requestTooLarge"), 413)

  // One JSON-RPC message per request, as the 2026-07-28 revision requires. A 2025-era batch could
  // carry several tool calls under one admission, and each call has to be admitted for its own
  // resource below.
  if (Array.isArray(body.value)) return jsonRpcError(t("mcp.errors.batchUnsupported"), 400)

  const toolName = readCalledToolName(body.value)
  const tool = toolName ? findMcpTool(toolName) : undefined

  // Admission is the REST API's, called the way a REST route calls it: against the resource the
  // called tool reads, or against no resource for everything else (listing tools, the handshake).
  // A token that lacks the tool's scope therefore meets the same 401 as an unknown token, and a
  // revoked, expired or demoted token is refused on this request, because nothing is cached.
  const authentication = await authenticateApiRequest(
    request.headers.get("authorization"),
    tool?.resource ?? null,
    new Date()
  )

  if ("refused" in authentication) return jsonRpcError(t("api.errors.unauthorized"), 401)

  const { context } = authentication

  const tokenLimit = await rateLimitInstance.consume(
    `mcp.token:${context.tokenId}`,
    MCP_TOKEN_RATE_LIMIT_MAX,
    MCP_RATE_LIMIT_WINDOW_MS
  )

  if (!tokenLimit.allowed) {
    await writeAudit("auth.rate_limit.tripped", {
      actorUserId: context.userId,
      actorRole: context.role,
      ipAddress,
      userAgent,
      metadata: { route: MCP_ENDPOINT_PATH, apiTokenId: context.tokenId }
    })

    return jsonRpcError(t("errors.tooManyRequests"), 429)
  }

  const response = await mcpHandler.fetch(request, {
    authInfo: toAuthInfo({ ...context, ipAddress, userAgent }),
    // The body that was admitted is the body that runs: the SDK acts on this parsed value rather
    // than reading the request a second time.
    ...(body.value === undefined ? {} : { parsedBody: body.value })
  })

  return withResponseHeaders(response)
}

type JsonBody = { tooLarge: true } | { tooLarge: false; value: unknown }

// Read from a clone, so a body that is not JSON reaches the SDK unread and is answered with the
// protocol's own parse error rather than one invented here.
async function readJsonBody(request: Request): Promise<JsonBody> {
  if (request.method !== "POST") return { tooLarge: false, value: undefined }

  const text = await request.clone().text()

  if (text.length > MCP_MAX_BODY_LENGTH) return { tooLarge: true }

  try {
    return { tooLarge: false, value: JSON.parse(text) }
  } catch {
    return { tooLarge: false, value: undefined }
  }
}

// A JSON-RPC error with no request id, the shape the SDK's own Origin refusal uses, so a client reads
// every refusal from this endpoint the same way. The code is the HTTP status rather than the
// SDK's -32000: the 2026-07-28 revision marks -32000 to -32019 as legacy that new implementations
// should not use, and places application errors outside the range JSON-RPC reserves.
function jsonRpcError(message: string, status: number): Response {
  return Response.json(
    { jsonrpc: "2.0", error: { code: status, message }, id: null },
    { status, headers: RESPONSE_HEADERS }
  )
}

function withResponseHeaders(response: Response): Response {
  const headers = new Headers(response.headers)

  for (const [name, value] of Object.entries(RESPONSE_HEADERS)) headers.set(name, value)

  return new Response(response.body, { status: response.status, headers })
}
