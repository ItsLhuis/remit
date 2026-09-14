import { eq } from "drizzle-orm"

import { database } from "@/database"
import { apiTokens, members } from "@/database/schema"

import { type ApiTokenScope } from "./schemas"

export type ApiTokenCredentialRow = {
  id: string
  tokenHash: string
  scopes: ApiTokenScope[]
  createdByUserId: string | null
  expiresAt: Date | null
  revokedAt: Date | null
}

// Found by hash through `uq_api_tokens_token_hash`, never by prefix: a lookup on anything shorter
// than the whole credential would let a caller learn which prefixes exist.
export async function findApiTokenByHash(tokenHash: string): Promise<ApiTokenCredentialRow | null> {
  const [row] = await database
    .select({
      id: apiTokens.id,
      tokenHash: apiTokens.tokenHash,
      scopes: apiTokens.scopes,
      createdByUserId: apiTokens.createdByUserId,
      expiresAt: apiTokens.expiresAt,
      revokedAt: apiTokens.revokedAt
    })
    .from(apiTokens)
    .where(eq(apiTokens.tokenHash, tokenHash))
    .limit(1)

  return row ?? null
}

// A read-only select of a Better Auth-owned table, which `.agents/rules/auth.md` permits where no
// API covers the case: every Better Auth role lookup takes the session's headers, and an API request
// has no session. `lib/auth/session.ts`'s `getCurrentRole` falls back to the same read. Nothing here
// creates or repairs a membership — a creator with none resolves to null and every request is
// refused.
export async function getMemberRole(userId: string): Promise<string | null> {
  const [member] = await database
    .select({ role: members.role })
    .from(members)
    .where(eq(members.userId, userId))
    .limit(1)

  return member?.role ?? null
}
