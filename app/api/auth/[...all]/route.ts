import { NextResponse, type NextRequest } from "next/server"

import { toNextJsHandler } from "better-auth/next-js"

import { eq } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { auth } from "@/lib/auth"

import { writeAudit, writeRateLimitTripAudit } from "@/lib/audit"

import { logger } from "@/lib/logger"

import { getIpAddress } from "@/lib/utils"

import { countRateLimitTrip } from "@/lib/rateLimit"

import { database } from "@/database"
import { users } from "@/database/schema"

const handler = toNextJsHandler(auth)

// The audit window of every refusal in this file, never one entry per refused attempt: Better
// Auth's limits get one per address and path, the two-factor disable refusal one per instance.
// Better Auth applies its limits itself, counting them in Redis through `lib/rateLimit`'s
// `toBetterAuthRateLimitStorage`, and tells this route only that it refused, so the length is its
// default window and sign-in's, 15 minutes (`lib/auth/index.ts`).
const AUTH_TRIP_WINDOW_MS = 15 * 60 * 1000

type AuditContext = {
  ipAddress: string | null
  userAgent: string | null
}

type AuditedAuthRoute =
  | "signIn"
  | "signUp"
  | "backupCode"
  | "requestPasswordReset"
  | "changePassword"
  | "enableTwoFactor"
  | "verifyTotp"
  | "generateBackupCodes"

function getAuditedRoute(pathname: string): AuditedAuthRoute | null {
  if (pathname.endsWith("/sign-in/email")) return "signIn"
  if (pathname.endsWith("/sign-up/email")) return "signUp"
  if (pathname.endsWith("/two-factor/verify-backup-code")) return "backupCode"
  if (pathname.endsWith("/request-password-reset")) return "requestPasswordReset"
  if (pathname.endsWith("/change-password")) return "changePassword"
  if (pathname.endsWith("/two-factor/enable")) return "enableTwoFactor"
  if (pathname.endsWith("/two-factor/verify-totp")) return "verifyTotp"
  if (pathname.endsWith("/two-factor/generate-backup-codes")) return "generateBackupCodes"

  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function getStringProperty(value: unknown, key: string): string | null {
  if (!isRecord(value)) return null

  const property = value[key]

  return typeof property === "string" ? property : null
}

// Both readers clone before consuming. A body stream can be read once, and here the original is
// still needed afterwards: `POST` reads the request body for audit metadata and then hands the same
// request to Better Auth, and reads the response body for its user id before returning that
// response to the client. Dropping either `clone()` leaves the real consumer with a drained stream.
async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.clone().json()
  } catch {
    return null
  }
}

async function readResponseJson(response: Response): Promise<unknown> {
  try {
    return await response.clone().json()
  } catch {
    return null
  }
}

function getResponseUserId(value: unknown): string | null {
  if (!isRecord(value)) return null

  const user = value.user

  return getStringProperty(user, "id")
}

type SessionUser = {
  id: string
}

async function getSessionUser(request: NextRequest): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: request.headers })

  return session?.user ? { id: session.user.id } : null
}

type WriteAuditContext = AuditContext & {
  actorUserId?: string
  targetEntityType?: "user"
  targetEntityId?: string
}

function withUserAuditContext(context: AuditContext, user: SessionUser | null): WriteAuditContext {
  if (!user) return context

  return {
    ...context,
    actorUserId: user.id,
    targetEntityType: "user",
    targetEntityId: user.id
  }
}

// Remit-owned recovery flag; Better Auth remains responsible for password and session state.
async function clearMustChangePassword(userId: string): Promise<void> {
  await database.update(users).set({ mustChangePassword: false }).where(eq(users.id, userId))
}

function getEmailMetadata(body: unknown): { email: string } | undefined {
  const email = getStringProperty(body, "email")

  return email ? { email } : undefined
}

function isSuccess(response: Response): boolean {
  return response.status >= 200 && response.status < 300
}

async function auditSignInResponse(
  response: Response,
  context: AuditContext,
  body: unknown
): Promise<void> {
  if (isSuccess(response)) {
    const responseBody = await readResponseJson(response)
    const actorUserId = getResponseUserId(responseBody)

    await writeAudit("auth.login.succeeded", {
      ...context,
      ...(actorUserId ? { actorUserId } : {})
    })

    return
  }

  const emailMetadata = getEmailMetadata(body)

  await writeAudit("auth.login.failed", {
    ...context,
    ...(emailMetadata ? { metadata: emailMetadata } : {})
  })
}

// Swallowed deliberately: the window has already counted this refusal as its first, so a throw here
// would lose the window's only entry and turn the refusal into a server error.
async function getRefusedSessionUser(request: NextRequest): Promise<SessionUser | null> {
  try {
    return await getSessionUser(request)
  } catch (error) {
    logger.error(
      { action: "api.auth.refuseTwoFactorDisable", err: error },
      "Session read failed, auditing the refusal without an actor"
    )

    return null
  }
}

// TOTP can never be disabled (`.agents/rules/security.md`), and Better Auth's handler clears the
// factor for any session holding the password, so the refusal comes before it. This path is open
// without a session and ahead of Better Auth's limiter, so the audit is windowed across the instance:
// a row per request would let an anonymous caller flood the insert-only `audit_logs`, and the key
// holds neither the address nor the pathname because the caller chooses both (`X-Forwarded-For`, the
// suffix match). The price is that a flood can hide who else tried; the count still says how many.
// Reading the session only for a written entry keeps a flood at one Redis round trip per request.
async function refuseTwoFactorDisable(request: NextRequest): Promise<Response> {
  const context: AuditContext = {
    ipAddress: getIpAddress(request.headers),
    userAgent: request.headers.get("user-agent") ?? null
  }
  const decision = await countRateLimitTrip("auth:two-factor-disable", AUTH_TRIP_WINDOW_MS)

  if (decision.write) {
    const user = await getRefusedSessionUser(request)

    await writeAudit("auth.totp.disable_refused", {
      ...withUserAuditContext(context, user),
      metadata: { suppressedSincePreviousEntry: decision.suppressedSincePreviousEntry }
    })
  }

  return NextResponse.json({ error: t("errors.forbidden") }, { status: 403 })
}

export const GET = handler.GET

export async function POST(request: NextRequest): Promise<Response> {
  const pathname = new URL(request.url).pathname

  if (pathname.endsWith("/two-factor/disable")) return await refuseTwoFactorDisable(request)

  const auditedRoute = getAuditedRoute(pathname)

  if (!auditedRoute) return handler.POST(request)

  const body = await readJson(request)
  const context: AuditContext = {
    ipAddress: getIpAddress(request.headers),
    userAgent: request.headers.get("user-agent") ?? null
  }
  const sessionUser =
    auditedRoute === "backupCode" || auditedRoute === "changePassword"
      ? await getSessionUser(request)
      : null

  const response = await handler.POST(request)

  if (response.status === 429) {
    await writeRateLimitTripAudit(
      { key: `auth:${pathname}:${context.ipAddress ?? "unknown"}`, windowMs: AUTH_TRIP_WINDOW_MS },
      { ...context, metadata: { path: pathname } }
    )

    return response
  }

  if (auditedRoute === "signIn") {
    await auditSignInResponse(response, context, body)

    return response
  }

  // Sign-up is in `AuditedAuthRoute` only so a 429 on registration reaches the rate-limit audit
  // above; a successful sign-up writes nothing here. Dropping it from `getAuditedRoute` would send
  // the route down the unaudited fast path and silently stop auditing registration rate-limit
  // trips, which `security.md` requires.
  if (auditedRoute === "signUp") return response

  if (!isSuccess(response)) return response

  if (auditedRoute === "backupCode") {
    await writeAudit("auth.backup_code.consumed", withUserAuditContext(context, sessionUser))

    return response
  }

  if (auditedRoute === "requestPasswordReset") {
    const emailMetadata = getEmailMetadata(body)

    await writeAudit("auth.password_reset.email_requested", {
      ...context,
      ...(emailMetadata ? { metadata: emailMetadata } : {})
    })

    return response
  }

  if (auditedRoute === "changePassword") {
    if (sessionUser) await clearMustChangePassword(sessionUser.id)

    await writeAudit("auth.password.changed", withUserAuditContext(context, sessionUser))

    return response
  }

  // The three two-factor mutations are in `AuditedAuthRoute` only so a 429 reaches the rate-limit
  // audit above. Their entries are written where the factor changes (`lib/auth/totpReconfigure.ts`),
  // which also covers `auth.api.*` callers; writing one per call here would record `enable` and
  // `generate-backup-codes` as reconfigurations and every sign-in verification with no actor.
  return response
}
