import { asc, like, or } from "drizzle-orm"

import { afterAll, describe, expect, test, vi } from "vitest"

import { auth } from "@/lib/auth"

import { getRateLimitConnection } from "@/lib/rateLimit/connection"

import { auditLogs, users } from "@/database/schema"

import { generateTotpCode } from "@/tests/e2e/support/totp"
import { database } from "@/tests/integration/database"

vi.mock("@/features/email/server", () => ({
  isEmailConfigured: () => true,
  sendTransactionalEmail: vi.fn(async () => null)
}))

const ACCOUNT_EMAIL = "auth-audit@example.test"
const ACCOUNT_PASSWORD = "OriginalPassword123!"

// Six characters that are not digits, so no TOTP code from any step can equal it.
const WRONG_CODE = "abcdef"

type AuthAuditEntry = {
  event: string
  actorUserId: string | null
  metadata: unknown
}

afterAll(async () => {
  const connection = await getRateLimitConnection()

  connection.disconnect()
})

function toCookieHeader(headers: Headers): Headers {
  const cookie = headers
    .getSetCookie()
    .map((setCookie) => setCookie.split(";")[0])
    .join("; ")

  return new Headers({ cookie })
}

function readSecret(totpURI: string): string {
  const secret = new URL(totpURI).searchParams.get("secret")

  if (!secret) throw new Error("The TOTP URI carried no secret parameter")

  return secret
}

async function readUserId(): Promise<string> {
  const [account] = await database.select({ id: users.id }).from(users)

  if (!account) throw new Error("No account exists")

  return account.id
}

async function readAuthAudit(): Promise<AuthAuditEntry[]> {
  return database
    .select({
      event: auditLogs.event,
      actorUserId: auditLogs.actorUserId,
      metadata: auditLogs.metadata
    })
    .from(auditLogs)
    .where(or(like(auditLogs.event, "auth.login.%"), like(auditLogs.event, "auth.backup_codes.%")))
    .orderBy(asc(auditLogs.createdAt))
}

async function readNewAuthAudit(before: AuthAuditEntry[]): Promise<AuthAuditEntry[]> {
  return (await readAuthAudit()).slice(before.length)
}

async function signUpAccount(): Promise<Headers> {
  const signUp = await auth.api.signUpEmail({
    body: { email: ACCOUNT_EMAIL, password: ACCOUNT_PASSWORD, name: "Auth Audit" },
    returnHeaders: true
  })

  return toCookieHeader(signUp.headers)
}

// Better Auth rotates the session when the first factor verifies, so only the cookies of that
// response stay valid; the sign-up cookie is dead after it.
async function enrolAccount(): Promise<{
  headers: Headers
  secret: string
  backupCodes: string[]
}> {
  const signUpHeaders = await signUpAccount()
  const { totpURI, backupCodes } = await auth.api.enableTwoFactor({
    headers: signUpHeaders,
    body: { password: ACCOUNT_PASSWORD }
  })
  const secret = readSecret(totpURI)

  const verification = await auth.api.verifyTOTP({
    headers: signUpHeaders,
    body: { code: generateTotpCode(secret) },
    returnHeaders: true
  })

  return { headers: toCookieHeader(verification.headers), secret, backupCodes }
}

// A fresh password sign-in of an enrolled account ends at the two-factor challenge; its cookie is
// what verify-totp and verify-backup-code read when there is no session.
async function startSignIn(): Promise<Headers> {
  const signIn = await auth.api.signInEmail({
    body: { email: ACCOUNT_EMAIL, password: ACCOUNT_PASSWORD },
    returnHeaders: true
  })

  return toCookieHeader(signIn.headers)
}

describe("auditing a sign-in by stage", () => {
  test("writes the password step and the session when no second factor applies", async () => {
    await signUpAccount()

    const userId = await readUserId()

    await auth.api.signInEmail({ body: { email: ACCOUNT_EMAIL, password: ACCOUNT_PASSWORD } })

    expect(await readAuthAudit()).toEqual([
      { event: "auth.login.password_verified", actorUserId: userId, metadata: null },
      { event: "auth.login.succeeded", actorUserId: userId, metadata: null }
    ])
  })

  test("writes only the password step when a second factor is still pending", async () => {
    await enrolAccount()

    const userId = await readUserId()
    const before = await readAuthAudit()

    await startSignIn()

    expect(await readNewAuthAudit(before)).toEqual([
      { event: "auth.login.password_verified", actorUserId: userId, metadata: null }
    ])
  })

  test("writes a password failure with the stage and the email when the password is wrong", async () => {
    await signUpAccount()

    const before = await readAuthAudit()

    await auth.api
      .signInEmail({ body: { email: ACCOUNT_EMAIL, password: "WrongPassword123!" } })
      .catch(() => null)

    expect(await readNewAuthAudit(before)).toEqual([
      {
        event: "auth.login.failed",
        actorUserId: null,
        metadata: { email: ACCOUNT_EMAIL, stage: "password" }
      }
    ])
  })

  test("writes the session with the acting user when a TOTP code completes the sign-in", async () => {
    const account = await enrolAccount()
    const userId = await readUserId()
    const headers = await startSignIn()
    const before = await readAuthAudit()

    await auth.api.verifyTOTP({ headers, body: { code: generateTotpCode(account.secret) } })

    expect(await readNewAuthAudit(before)).toEqual([
      { event: "auth.login.succeeded", actorUserId: userId, metadata: null }
    ])
  })

  test("writes the session with the acting user when a recovery code completes the sign-in", async () => {
    const account = await enrolAccount()
    const userId = await readUserId()
    const headers = await startSignIn()
    const before = await readAuthAudit()

    await auth.api.verifyBackupCode({ headers, body: { code: account.backupCodes[0] } })

    expect(await readNewAuthAudit(before)).toEqual([
      { event: "auth.login.succeeded", actorUserId: userId, metadata: null }
    ])
  })

  test("writes a second-factor failure with the stage and the user when the TOTP code is wrong", async () => {
    await enrolAccount()

    const userId = await readUserId()
    const headers = await startSignIn()
    const before = await readAuthAudit()

    await auth.api.verifyTOTP({ headers, body: { code: WRONG_CODE } }).catch(() => null)

    expect(await readNewAuthAudit(before)).toEqual([
      { event: "auth.login.failed", actorUserId: userId, metadata: { stage: "second_factor" } }
    ])
  })

  test("writes a second-factor failure when the recovery code is wrong", async () => {
    await enrolAccount()

    const userId = await readUserId()
    const headers = await startSignIn()
    const before = await readAuthAudit()

    await auth.api.verifyBackupCode({ headers, body: { code: "wrong-code" } }).catch(() => null)

    expect(await readNewAuthAudit(before)).toEqual([
      { event: "auth.login.failed", actorUserId: userId, metadata: { stage: "second_factor" } }
    ])
  })

  test("writes no login entry when a signed-in user verifies a code outside a sign-in", async () => {
    const account = await enrolAccount()
    const before = await readAuthAudit()

    await auth.api
      .verifyTOTP({ headers: account.headers, body: { code: WRONG_CODE } })
      .catch(() => null)
    await auth.api.verifyTOTP({
      headers: account.headers,
      body: { code: generateTotpCode(account.secret) }
    })

    expect(await readNewAuthAudit(before)).toEqual([])
  })

  test("writes nothing when a second factor is submitted with neither a session nor a challenge", async () => {
    await enrolAccount()

    const before = await readAuthAudit()

    await auth.api.verifyTOTP({ body: { code: WRONG_CODE } }).catch(() => null)
    await auth.api.verifyBackupCode({ body: { code: "wrong-code" } }).catch(() => null)

    expect(await readNewAuthAudit(before)).toEqual([])
  })

  test("writes no login entry when the first factor of an enrolment verifies", async () => {
    await enrolAccount()

    expect(await readAuthAudit()).toEqual([])
  })
})

describe("auditing a recovery code regeneration", () => {
  test("writes the regeneration with the acting user when the codes are replaced", async () => {
    const account = await enrolAccount()
    const userId = await readUserId()
    const before = await readAuthAudit()

    await auth.api.generateBackupCodes({
      headers: account.headers,
      body: { password: ACCOUNT_PASSWORD }
    })

    expect(await readNewAuthAudit(before)).toEqual([
      { event: "auth.backup_codes.regenerated", actorUserId: userId, metadata: null }
    ])
  })

  test("writes nothing when the password is wrong and the codes stay", async () => {
    const account = await enrolAccount()
    const before = await readAuthAudit()

    await auth.api
      .generateBackupCodes({ headers: account.headers, body: { password: "WrongPassword123!" } })
      .catch(() => null)

    expect(await readNewAuthAudit(before)).toEqual([])
  })
})
