import { NextRequest } from "next/server"

import { randomInt } from "node:crypto"

import { afterAll, describe, expect, test, vi } from "vitest"

import { auth } from "@/lib/auth"

import { getRateLimitConnection } from "@/lib/rateLimit/connection"

import { POST } from "@/app/api/auth/[...all]/route"
import { generateTotpCode } from "@/tests/e2e/support/totp"

vi.mock("@/features/email/server", () => ({
  isEmailConfigured: () => true,
  sendTransactionalEmail: vi.fn(async () => null)
}))

const ACCOUNT_EMAIL = "totp-reconfigure@example.test"
const ACCOUNT_PASSWORD = "OriginalPassword123!"

// Six characters that are not digits, so no TOTP code from any step can equal it.
const WRONG_CODE = "abcdef"

type EnrolledAccount = {
  headers: Headers
  secret: string
  backupCodes: string[]
}

afterAll(async () => {
  const connection = await getRateLimitConnection()

  connection.disconnect()
})

function readSecret(totpURI: string): string {
  const secret = new URL(totpURI).searchParams.get("secret")

  if (!secret) throw new Error("The TOTP URI carried no secret parameter")

  return secret
}

function toCookieHeader(headers: Headers): Headers {
  const cookie = headers
    .getSetCookie()
    .map((setCookie) => setCookie.split(";")[0])
    .join("; ")

  return new Headers({ cookie })
}

// Better Auth rotates the session when the first factor verifies, so only the cookies of that
// response stay valid; the sign-up cookie is dead after it.
async function enrolAccount(): Promise<EnrolledAccount> {
  const signUp = await auth.api.signUpEmail({
    body: { email: ACCOUNT_EMAIL, password: ACCOUNT_PASSWORD, name: "Totp Reconfigure" },
    returnHeaders: true
  })

  const signUpHeaders = toCookieHeader(signUp.headers)
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

// The reconfigure dialog's first step: the new secret exists only on the server until a code from
// it verifies.
async function startReconfigure(account: EnrolledAccount): Promise<string> {
  const { totpURI } = await auth.api.enableTwoFactor({
    headers: account.headers,
    body: { password: ACCOUNT_PASSWORD }
  })

  return readSecret(totpURI)
}

// The dialog's second step, with a session and no sign-in challenge.
async function submitCode(account: EnrolledAccount, code: string): Promise<boolean> {
  return auth.api
    .verifyTOTP({ headers: account.headers, body: { code } })
    .then(() => true)
    .catch(() => false)
}

// A fresh password sign-in ends at the two-factor challenge; its cookie is what verify-totp and
// verify-backup-code read when there is no session.
async function startSignIn(): Promise<Headers> {
  const signIn = await auth.api.signInEmail({
    body: { email: ACCOUNT_EMAIL, password: ACCOUNT_PASSWORD },
    returnHeaders: true
  })

  return toCookieHeader(signIn.headers)
}

async function signInWithTotp(secret: string): Promise<boolean> {
  const headers = await startSignIn()

  return auth.api
    .verifyTOTP({ headers, body: { code: generateTotpCode(secret) } })
    .then(() => true)
    .catch(() => false)
}

async function signInWithBackupCode(code: string): Promise<boolean> {
  const headers = await startSignIn()

  return auth.api
    .verifyBackupCode({ headers, body: { code } })
    .then(() => true)
    .catch(() => false)
}

// Better Auth limits `/two-factor/*` to 3 requests per 10 seconds per address and path, counted in
// Redis that no test resets, so every request of a test comes from an address nothing else used.
function randomAddress(): string {
  return `198.51.${randomInt(0, 256)}.${randomInt(1, 255)}`
}

function postAuth(
  path: string,
  request: { cookie: string; body: unknown; address: string }
): Promise<Response> {
  return POST(
    new NextRequest(`http://localhost:3000/api/auth/two-factor/${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: request.cookie,
        origin: "http://localhost:3000",
        "x-forwarded-for": request.address
      },
      body: JSON.stringify(request.body)
    })
  )
}

function readCookie(account: EnrolledAccount): string {
  const cookie = account.headers.get("cookie")

  if (!cookie) throw new Error("The enrolled account carries no session cookie")

  return cookie
}

describe("reconfiguring a verified TOTP factor", () => {
  test("keeps the old authenticator and recovery codes when a reconfigure stops after enable", async () => {
    const account = await enrolAccount()

    const newSecret = await startReconfigure(account)

    expect({
      newSecret: await signInWithTotp(newSecret),
      oldSecret: await signInWithTotp(account.secret),
      oldBackupCode: await signInWithBackupCode(account.backupCodes[0])
    }).toEqual({ newSecret: false, oldSecret: true, oldBackupCode: true })
  })

  test("signs in with the new authenticator and refuses the old one when a code from the new secret verified", async () => {
    const account = await enrolAccount()
    const newSecret = await startReconfigure(account)

    await submitCode(account, generateTotpCode(newSecret))

    expect({
      newSecret: await signInWithTotp(newSecret),
      oldSecret: await signInWithTotp(account.secret)
    }).toEqual({ newSecret: true, oldSecret: false })
  })

  test("verifies the same code again when the swap already happened", async () => {
    const account = await enrolAccount()
    const code = generateTotpCode(await startReconfigure(account))

    await submitCode(account, code)

    expect(await submitCode(account, code)).toBe(true)
  })

  test("keeps the saved recovery codes working until generate-backup-codes replaces them when the new secret verified", async () => {
    const account = await enrolAccount()
    const newSecret = await startReconfigure(account)

    await submitCode(account, generateTotpCode(newSecret))

    const savedCodeWorks = await signInWithBackupCode(account.backupCodes[0])

    await auth.api.generateBackupCodes({
      headers: account.headers,
      body: { password: ACCOUNT_PASSWORD }
    })

    expect({
      savedCodeWorks,
      savedCodeAfterReplacement: await signInWithBackupCode(account.backupCodes[1])
    }).toEqual({ savedCodeWorks: true, savedCodeAfterReplacement: false })
  })

  test("keeps the old factor in force when a wrong code is submitted", async () => {
    const account = await enrolAccount()
    const newSecret = await startReconfigure(account)

    const wrongCodeVerified = await submitCode(account, WRONG_CODE)

    expect({
      wrongCodeVerified,
      newSecret: await signInWithTotp(newSecret),
      oldSecret: await signInWithTotp(account.secret)
    }).toEqual({ wrongCodeVerified: false, newSecret: false, oldSecret: true })
  })

  test("verifies a code from the pending secret when an earlier wrong code was refused", async () => {
    const account = await enrolAccount()
    const newSecret = await startReconfigure(account)

    await submitCode(account, WRONG_CODE)

    expect(await submitCode(account, generateTotpCode(newSecret))).toBe(true)
  })

  test("refuses the request and keeps the old factor when the password is wrong", async () => {
    const account = await enrolAccount()

    const refused = await auth.api
      .enableTwoFactor({ headers: account.headers, body: { password: "WrongPassword123!" } })
      .then(() => false)
      .catch(() => true)

    expect({
      refused,
      oldSecret: await signInWithTotp(account.secret),
      oldBackupCode: await signInWithBackupCode(account.backupCodes[0])
    }).toEqual({ refused: true, oldSecret: true, oldBackupCode: true })
  })

  test("refuses the request and keeps the old factor when the body fails validation", async () => {
    const account = await enrolAccount()

    const response = await postAuth("enable", {
      cookie: readCookie(account),
      body: { password: 123 },
      address: randomAddress()
    })

    expect({
      status: response.status,
      oldSecret: await signInWithTotp(account.secret),
      oldBackupCode: await signInWithBackupCode(account.backupCodes[0])
    }).toEqual({ status: 400, oldSecret: true, oldBackupCode: true })
  })

  test("switches the factor over HTTP only when a code from the new secret verifies", async () => {
    const account = await enrolAccount()
    const cookie = readCookie(account)
    const address = randomAddress()

    const enable = await postAuth("enable", {
      cookie,
      body: { password: ACCOUNT_PASSWORD },
      address
    })
    const enableBody: { totpURI: string; backupCodes: string[] } = await enable.json()
    const newSecret = readSecret(enableBody.totpURI)

    const wrongCode = await postAuth("verify-totp", { cookie, body: { code: WRONG_CODE }, address })
    const oldSecretAfterWrongCode = await signInWithTotp(account.secret)
    const rightCode = await postAuth("verify-totp", {
      cookie,
      body: { code: generateTotpCode(newSecret) },
      address
    })

    expect({
      enable: enable.status,
      backupCodes: enableBody.backupCodes,
      wrongCode: wrongCode.status,
      oldSecretAfterWrongCode,
      rightCode: rightCode.status,
      newSecretAfterRightCode: await signInWithTotp(newSecret)
    }).toEqual({
      enable: 200,
      backupCodes: [],
      wrongCode: 401,
      oldSecretAfterWrongCode: true,
      rightCode: 200,
      newSecretAfterRightCode: true
    })
  })
})
