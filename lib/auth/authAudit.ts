import { type BetterAuthPlugin, type GenericEndpointContext } from "better-auth"
import { createAuthMiddleware, getSessionFromCtx, isAPIError } from "better-auth/api"

import { z } from "zod"

import { writeAudit } from "@/lib/audit"

import { buildAuditContext } from "./auditContext"

const SIGN_IN_PATH = "/sign-in/email"
const VERIFY_TOTP_PATH = "/two-factor/verify-totp"
const VERIFY_BACKUP_CODE_PATH = "/two-factor/verify-backup-code"
const GENERATE_BACKUP_CODES_PATH = "/two-factor/generate-backup-codes"

// Better Auth's own name for the cookie that carries a sign-in's pending second factor; its
// constant is not exported.
const CHALLENGE_COOKIE_NAME = "two_factor"

// Where the `before` hook leaves the challenge for the `after` hook. Better Auth merges a
// `{ context }` return into the request, and consumes the challenge entry while it verifies, so
// the user is only readable before the endpoint runs.
const CHALLENGE_KEY = "remitSignInChallenge"

const emailBodySchema = z.object({ email: z.string() })

const challengeSchema = z.object({ userId: z.string() })

function isSecondFactorPath(path: string | undefined): boolean {
  return path === VERIFY_TOTP_PATH || path === VERIFY_BACKUP_CODE_PATH
}

function isTwoFactorRedirect(returned: unknown): boolean {
  return (
    typeof returned === "object" &&
    returned !== null &&
    "twoFactorRedirect" in returned &&
    returned.twoFactorRedirect === true
  )
}

function readChallengeUserId(ctx: unknown): string | null {
  if (typeof ctx !== "object" || ctx === null || !(CHALLENGE_KEY in ctx)) return null

  const parsed = challengeSchema.safeParse(ctx[CHALLENGE_KEY])

  return parsed.success ? parsed.data.userId : null
}

async function findChallengeUserId(ctx: GenericEndpointContext): Promise<string | null> {
  const cookie = ctx.context.createAuthCookie(CHALLENGE_COOKIE_NAME)
  const identifier = await ctx.getSignedCookie(cookie.name, ctx.context.secret)

  if (!identifier) return null

  const entry = await ctx.context.internalAdapter.findVerificationValue(identifier)

  return entry?.value ?? null
}

async function auditSignIn(ctx: GenericEndpointContext): Promise<void> {
  const returned = ctx.context.returned
  const body = emailBodySchema.safeParse(ctx.body)

  if (isAPIError(returned)) {
    await writeAudit("auth.login.failed", {
      ...buildAuditContext(ctx, null),
      metadata: { ...(body.success ? { email: body.data.email } : {}), stage: "password" }
    })

    return
  }

  const sessionUserId = ctx.context.newSession?.user.id ?? null
  const pending = isTwoFactorRedirect(returned)
  const userId =
    sessionUserId ??
    (pending && body.success
      ? ((await ctx.context.internalAdapter.findUserByEmail(body.data.email))?.user.id ?? null)
      : null)

  await writeAudit("auth.login.password_verified", buildAuditContext(ctx, userId))

  if (!pending) await writeAudit("auth.login.succeeded", buildAuditContext(ctx, userId))
}

async function auditSecondFactor(ctx: GenericEndpointContext): Promise<void> {
  // A request that carries a session (the reconfigure dialog, a first enrolment) never has a
  // challenge, so it is not a sign-in; a request with neither is not audited at all, so an
  // anonymous caller cannot add a row per request to the insert-only table.
  const userId = readChallengeUserId(ctx)

  if (!userId) return

  if (isAPIError(ctx.context.returned)) {
    await writeAudit("auth.login.failed", {
      ...buildAuditContext(ctx, userId),
      metadata: { stage: "second_factor" }
    })

    return
  }

  // `disableSession` answers with a token and sets no session, so it establishes no login.
  if (
    ctx.path === VERIFY_BACKUP_CODE_PATH &&
    z.object({ disableSession: z.literal(true) }).safeParse(ctx.body).success
  ) {
    return
  }

  await writeAudit("auth.login.succeeded", buildAuditContext(ctx, userId))
}

async function auditBackupCodesRegenerated(ctx: GenericEndpointContext): Promise<void> {
  if (isAPIError(ctx.context.returned)) return

  const session = await getSessionFromCtx(ctx)

  if (!session) return

  await writeAudit("auth.backup_codes.regenerated", buildAuditContext(ctx, session.user.id))
}

// The sign-in and recovery-code entries are written here and not by the route so that
// `auth.api.*` callers are audited too, and so that `auth.login.succeeded` follows the session
// being established rather than the password step answering.
export const authAudit = {
  id: "auth-audit",
  hooks: {
    before: [
      {
        matcher: (context) => isSecondFactorPath(context.path),
        handler: createAuthMiddleware(async (ctx) => {
          if (await getSessionFromCtx(ctx)) return

          const userId = await findChallengeUserId(ctx)

          if (!userId) return

          return { context: { [CHALLENGE_KEY]: { userId } } }
        })
      }
    ],
    after: [
      {
        matcher: (context) => context.path === SIGN_IN_PATH,
        handler: createAuthMiddleware(auditSignIn)
      },
      {
        matcher: (context) => isSecondFactorPath(context.path),
        handler: createAuthMiddleware(auditSecondFactor)
      },
      {
        matcher: (context) => context.path === GENERATE_BACKUP_CODES_PATH,
        handler: createAuthMiddleware(auditBackupCodesRegenerated)
      }
    ]
  }
} satisfies BetterAuthPlugin
