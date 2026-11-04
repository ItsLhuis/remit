import { type BetterAuthPlugin, type GenericEndpointContext } from "better-auth"
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api"
import { generateRandomString, symmetricDecrypt, symmetricEncrypt } from "better-auth/crypto"
import { parseUserOutput } from "better-auth/db"
import { TWO_FACTOR_ERROR_CODES } from "better-auth/plugins"

import { z } from "zod"

import { buildTotpUri, verifyTotpCode } from "./totp"

const ENABLE_PATH = "/two-factor/enable"
const VERIFY_TOTP_PATH = "/two-factor/verify-totp"

const SECRET_LENGTH = 32
const DEFAULT_DIGITS = 6
const DEFAULT_PERIOD = 30

const enableBodySchema = z.object({
  password: z.string(),
  issuer: z.string().optional()
})

const verifyTotpBodySchema = z.object({
  code: z.string(),
  trustDevice: z.boolean().optional()
})

type Session = NonNullable<Awaited<ReturnType<typeof getSessionFromCtx>>>

function pendingIdentifier(userId: string): string {
  return `totp-reconfigure-${userId}`
}

function invalidBody(): APIError {
  return APIError.from("BAD_REQUEST", {
    message: "Invalid request body",
    code: "VALIDATION_ERROR"
  })
}

// Better Auth's own test for carrying `verified` onto a replaced row.
async function hasVerifiedFactor(ctx: GenericEndpointContext, userId: string): Promise<boolean> {
  const factor = await ctx.context.adapter.findOne<{ verified?: boolean | null }>({
    model: "twoFactor",
    where: [{ field: "userId", value: userId }]
  })

  return factor != null && factor.verified !== false
}

async function findPendingSecret(
  ctx: GenericEndpointContext,
  userId: string
): Promise<string | null> {
  const entry = await ctx.context.internalAdapter.findVerificationValue(pendingIdentifier(userId))

  if (!entry || entry.expiresAt.getTime() <= Date.now()) return null

  return entry.value
}

function readTotpParameters(ctx: GenericEndpointContext) {
  const options = ctx.context.getPlugin("two-factor")?.options

  return {
    issuer: options?.issuer,
    digits: options?.totpOptions?.digits || DEFAULT_DIGITS,
    period: options?.totpOptions?.period || DEFAULT_PERIOD
  }
}

async function holdPendingSecret(ctx: GenericEndpointContext, session: Session) {
  const parsed = enableBodySchema.safeParse(ctx.body)

  if (!parsed.success) throw invalidBody()

  await ctx.context.password.checkPassword(session.user.id, ctx)

  const secret = generateRandomString(SECRET_LENGTH)
  const identifier = pendingIdentifier(session.user.id)
  const { issuer, digits, period } = readTotpParameters(ctx)

  await ctx.context.internalAdapter.deleteVerificationByIdentifier(identifier)
  await ctx.context.internalAdapter.createVerificationValue({
    identifier,
    value: await symmetricEncrypt({ key: ctx.context.secretConfig, data: secret }),
    expiresAt: session.session.expiresAt
  })

  return {
    totpURI: buildTotpUri({
      secret,
      issuer: parsed.data.issuer || issuer || ctx.context.appName,
      account: session.user.email,
      digits,
      period
    }),
    backupCodes: []
  }
}

async function swapPendingSecret(
  ctx: GenericEndpointContext,
  session: Session,
  pendingCiphertext: string
) {
  const parsed = verifyTotpBodySchema.safeParse(ctx.body)

  if (!parsed.success) throw invalidBody()

  const { digits, period } = readTotpParameters(ctx)
  const secret = await symmetricDecrypt({ key: ctx.context.secretConfig, data: pendingCiphertext })

  // The factor and the pending entry stay as they are, so the user can scan again and retry.
  if (!verifyTotpCode({ secret, code: parsed.data.code, digits, period, now: Date.now() })) {
    throw APIError.from("UNAUTHORIZED", TWO_FACTOR_ERROR_CODES.INVALID_CODE)
  }

  // One row update, so the account has the old factor or the new one and never neither. The
  // ciphertext was made with Better Auth's own `symmetricEncrypt`, which is what its handlers read.
  const swapped = await ctx.context.adapter.update({
    model: "twoFactor",
    where: [{ field: "userId", value: session.user.id }],
    update: { secret: pendingCiphertext }
  })

  // The adapter answers null when no row matched, e.g. the factor was disabled after `enable`.
  if (!swapped) throw APIError.from("BAD_REQUEST", TWO_FACTOR_ERROR_CODES.TOTP_NOT_ENABLED)

  await ctx.context.internalAdapter.deleteVerificationByIdentifier(
    pendingIdentifier(session.user.id)
  )

  return {
    token: session.session.token,
    user: parseUserOutput(ctx.context.options, session.user)
  }
}

// Better Auth's `enable` replaces a verified user's factor with an unproven secret at the first
// step of a reconfiguration, which locks out the authenticator and recovery codes the user holds.
// This plugin answers `enable` for such a user by holding the new secret as a pending
// `verifications` entry, and swaps it into `two_factors.secret` only when a code from it verifies.
// The matchers compare the endpoint's own path, which the router and `auth.api.*` both set.
export const totpReconfigure = {
  id: "totp-reconfigure",
  hooks: {
    before: [
      {
        matcher: (context) => context.path === ENABLE_PATH,
        handler: createAuthMiddleware(async (ctx) => {
          const session = await getSessionFromCtx(ctx)

          // Read from the table, never `session.user.twoFactorEnabled`: the cookie cache can keep
          // that stale for minutes. Once a verified factor exists every outcome is answered here,
          // because handing the request on to Better Auth's handler is the lockout itself.
          if (!session || !(await hasVerifiedFactor(ctx, session.user.id))) return

          return ctx.json(await holdPendingSecret(ctx, session))
        })
      },
      {
        matcher: (context) => context.path === VERIFY_TOTP_PATH,
        handler: createAuthMiddleware(async (ctx) => {
          const session = await getSessionFromCtx(ctx)

          // The entry can outlive the factor it was made for, and first-time enrolment must never
          // consult it.
          if (!session || !(await hasVerifiedFactor(ctx, session.user.id))) return

          // The entry expires with the session that made it, not after a fixed time: the dialog
          // cannot outlive its session, and an entry that lapsed first would let the old
          // authenticator's code verify through Better Auth while the dialog reports a
          // reconfiguration that never happened. Once swapped the entry is gone, and handing on is
          // what a retry of the same code needs: Better Auth verifies it against the new factor.
          const pendingCiphertext = await findPendingSecret(ctx, session.user.id)

          if (!pendingCiphertext) return

          return ctx.json(await swapPendingSecret(ctx, session, pendingCiphertext))
        })
      }
    ]
  }
} satisfies BetterAuthPlugin
