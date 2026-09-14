import { and, eq, isNull, lt, or } from "drizzle-orm"

import { logger } from "@/lib/logger"

import {
  hashApiToken,
  isWellFormedApiToken,
  matchesApiTokenHash,
  parseBearerCredential
} from "@/lib/apiToken"

import { database } from "@/database"
import { apiTokens } from "@/database/schema"

import { findApiTokenByHash, getMemberRole } from "./queries"
import { type ApiResource } from "./schemas"
import { evaluateApiTokenAccess, type ApiTokenRole } from "./services/apiAccess"

export type ApiRequestContext = {
  tokenId: string
  userId: string
  role: ApiTokenRole
}

export type ApiAuthentication = { context: ApiRequestContext } | { refused: true }

// `last_used_at` is informational, so it is written at most once a minute per token rather than on
// every request: a busy integration would otherwise turn every read into a write on the primary.
const LAST_USED_RESOLUTION_MS = 60 * 1000

// Every refusal — no credential, a malformed one, an unknown one, a revoked, expired or
// out-of-scope one, a creator who is gone — collapses into the same `{ refused: true }`, and the
// route answers all of them with one response. A caller probing with a token must not learn which
// of those it is holding, and in particular must not learn that a token it found is real but lacks
// a scope.
//
// There is no cache between this lookup and the database, which is what makes a revocation take
// effect on the very next request.
export async function authenticateApiRequest(
  authorization: string | null,
  resource: ApiResource | null,
  now: Date
): Promise<ApiAuthentication> {
  const token = parseBearerCredential(authorization)

  if (!token || !isWellFormedApiToken(token)) return { refused: true }

  const tokenHash = hashApiToken(token)
  const row = await findApiTokenByHash(tokenHash)

  if (!row || !matchesApiTokenHash(tokenHash, row.tokenHash)) return { refused: true }

  if (!row.createdByUserId) return { refused: true }

  const access = evaluateApiTokenAccess({
    resource,
    scopes: row.scopes,
    creatorRole: await getMemberRole(row.createdByUserId),
    revokedAt: row.revokedAt,
    expiresAt: row.expiresAt,
    now
  })

  if (!access.allowed) return { refused: true }

  await touchApiToken(row.id, now)

  return { context: { tokenId: row.id, userId: row.createdByUserId, role: access.role } }
}

// A failed touch is logged and swallowed: the request is already authenticated, and refusing it
// because a bookkeeping timestamp could not be written would turn a database hiccup into an outage
// of the whole API.
async function touchApiToken(tokenId: string, now: Date): Promise<void> {
  try {
    await database
      .update(apiTokens)
      .set({ lastUsedAt: now })
      .where(
        and(
          eq(apiTokens.id, tokenId),
          or(
            isNull(apiTokens.lastUsedAt),
            lt(apiTokens.lastUsedAt, new Date(now.getTime() - LAST_USED_RESOLUTION_MS))
          )
        )
      )
  } catch (error) {
    logger.error({ action: "api.authenticate", tokenId, err: error }, "API token touch failed")
  }
}
