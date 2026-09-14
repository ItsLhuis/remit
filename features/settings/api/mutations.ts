"use server"

import { revalidatePath } from "next/cache"

import { headers } from "next/headers"

import { and, eq, isNull } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { auth } from "@/lib/auth"
import { getCurrentRole, type Role } from "@/lib/auth/session"

import { writeAudit } from "@/lib/audit"

import { logger } from "@/lib/logger"

import { getIpAddress } from "@/lib/utils"

import { issueApiToken } from "@/lib/apiToken"

import { database } from "@/database"
import { apiTokens } from "@/database/schema"

import { apiTokenListColumns, toApiTokenListItem } from "./queries"
import { createApiTokenSchema, revokeApiTokenSchema } from "./schemas"
import { resolveApiTokenExpiry } from "./services/apiTokenLifecycle"
import { type ApiTokenListItem } from "./types"

type CreateApiTokenResult =
  | { data: { token: ApiTokenListItem; secret: string } }
  | { error: string }

type RevokeApiTokenResult = { data: { token: ApiTokenListItem } } | { error: string }

type ApiTokenWriteContext = {
  userId: string
  role: Role
  ipAddress: string | null
  userAgent: string | null
}

type ApiTokenWriteGate = { context: ApiTokenWriteContext } | { error: string }

const apiSettingsPath = "/settings/api"

// The plaintext token leaves this action exactly once, in the return value the dialog reveals, and
// is never written anywhere: not to the row (`token_hash` only), not to the audit entry, not to a
// log line. A caller who loses it revokes and mints another.
export async function createApiToken(input: unknown): Promise<CreateApiTokenResult> {
  const gate = await requireApiTokenWrite()

  if ("error" in gate) return gate

  const parsed = createApiTokenSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate
  const { name, expiry } = parsed.data
  const scopes = Array.from(new Set(parsed.data.scopes))
  const issued = issueApiToken()
  const now = new Date()

  try {
    const [row] = await database
      .insert(apiTokens)
      .values({
        name,
        tokenHash: issued.tokenHash,
        tokenPrefix: issued.tokenPrefix,
        scopes,
        createdByUserId: context.userId,
        expiresAt: resolveApiTokenExpiry(expiry, now)
      })
      .returning(apiTokenListColumns)

    if (!row) throw new Error("API token insert returned no row")

    await writeApiTokenAudit(context, "api_token.created", row.id, {
      name,
      scopes,
      expiresAt: row.expiresAt?.toISOString() ?? null
    })

    revalidatePath(apiSettingsPath)

    return { data: { token: toApiTokenListItem(row, now), secret: issued.token } }
  } catch (error) {
    return handleApiTokenError(error, "createApiToken", context.userId, "createFailed")
  }
}

// Revocation takes effect on the next request with no further step, because
// `features/api/authenticate.ts` reads `revoked_at` from the row on every call and nothing caches
// it. Revoking an already-revoked token answers with the row unchanged rather than an error: the
// owner's intent is already true.
export async function revokeApiToken(input: unknown): Promise<RevokeApiTokenResult> {
  const gate = await requireApiTokenWrite()

  if ("error" in gate) return gate

  const parsed = revokeApiTokenSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate
  const { tokenId } = parsed.data
  const now = new Date()

  try {
    const [revoked] = await database
      .update(apiTokens)
      .set({ revokedAt: now })
      .where(and(eq(apiTokens.id, tokenId), isNull(apiTokens.revokedAt)))
      .returning(apiTokenListColumns)

    if (!revoked) {
      const [existing] = await database
        .select(apiTokenListColumns)
        .from(apiTokens)
        .where(eq(apiTokens.id, tokenId))
        .limit(1)

      if (!existing) return { error: t("settings.api.errors.notFound") }

      return { data: { token: toApiTokenListItem(existing, now) } }
    }

    await writeApiTokenAudit(context, "api_token.revoked", revoked.id, { name: revoked.name })

    revalidatePath(apiSettingsPath)

    return { data: { token: toApiTokenListItem(revoked, now) } }
  } catch (error) {
    return handleApiTokenError(error, "revokeApiToken", context.userId, "revokeFailed")
  }
}

// Owner-only, on the footing of the client portal link: a standing bearer credential to the
// instance's business data is a transmit decision, which ARCHITECTURE.md's role table refuses to
// both other roles.
async function requireApiTokenWrite(): Promise<ApiTokenWriteGate> {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({ headers: requestHeaders })

  if (!session) return { error: t("errors.unauthorized") }

  const role = await getCurrentRole({ headers: requestHeaders, userId: session.user.id })

  if (role !== "owner") return { error: t("errors.forbidden") }

  return {
    context: {
      userId: session.user.id,
      role,
      ipAddress: getIpAddress(requestHeaders),
      userAgent: requestHeaders.get("user-agent")
    }
  }
}

async function writeApiTokenAudit(
  context: ApiTokenWriteContext,
  event: "api_token.created" | "api_token.revoked",
  tokenId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  await writeAudit(event, {
    actorUserId: context.userId,
    actorRole: context.role,
    targetEntityType: "api_token",
    targetEntityId: tokenId,
    metadata,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent
  })
}

function handleApiTokenError(
  error: unknown,
  action: string,
  userId: string,
  fallback: "createFailed" | "revokeFailed"
): { error: string } {
  logger.error({ action, userId, err: error }, "API token action failed")

  return { error: t(`settings.api.errors.${fallback}`) }
}
