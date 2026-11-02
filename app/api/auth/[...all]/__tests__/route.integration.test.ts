import { NextRequest } from "next/server"

import { randomUUID } from "node:crypto"

import { eq } from "drizzle-orm"

import { afterAll, expect, test, vi } from "vitest"

import { auth } from "@/lib/auth"

import { getRateLimitConnection } from "@/lib/rateLimit/connection"

import { auditLogs, twoFactors, users } from "@/database/schema"

import { generateTotpCode } from "@/tests/e2e/support/totp"
import { database } from "@/tests/integration/database"

import { POST } from "../route"

vi.mock("@/features/email/server", () => ({
  isEmailConfigured: () => true,
  sendTransactionalEmail: vi.fn(async () => null)
}))

const ACCOUNT_EMAIL = "two-factor-disable@example.test"
const ACCOUNT_PASSWORD = "OriginalPassword123!"

afterAll(async () => {
  const connection = await getRateLimitConnection()

  connection.disconnect()
})

// Better Auth rotates the session when TOTP verifies, so only the cookies of that response stay
// valid; the sign-up cookie is dead after it.
async function enrolAccount(): Promise<{ cookie: string; userId: string }> {
  const signUp = await auth.api.signUpEmail({
    body: { email: ACCOUNT_EMAIL, password: ACCOUNT_PASSWORD, name: "Two Factor" },
    returnHeaders: true
  })

  const sessionCookie = signUp.headers.get("set-cookie")

  if (!sessionCookie) throw new Error("Sign-up returned no session cookie")

  const headers = new Headers({ cookie: sessionCookie })
  const { totpURI } = await auth.api.enableTwoFactor({
    headers,
    body: { password: ACCOUNT_PASSWORD }
  })

  const secret = new URL(totpURI).searchParams.get("secret")

  if (!secret) throw new Error("Better Auth returned a TOTP URI with no secret parameter")

  const verification = await auth.api.verifyTOTP({
    headers,
    body: { code: generateTotpCode(secret) },
    returnHeaders: true
  })

  const cookie = verification.headers
    .getSetCookie()
    .map((setCookie) => setCookie.split(";")[0])
    .join("; ")

  return { cookie, userId: signUp.response.user.id }
}

test("refuses an enrolled user's disable request with the correct password and keeps the factor", async () => {
  const { cookie, userId } = await enrolAccount()

  // A fresh address per run: the trip window lives in Redis, which `tests/integration/setup.ts` does
  // not reset, so a repeated address inside 15 minutes would write no entry.
  const response = await POST(
    new NextRequest("http://localhost:3000/api/auth/two-factor/disable", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        origin: "http://localhost:3000",
        "x-forwarded-for": `fake-${randomUUID()}`
      },
      body: JSON.stringify({ password: ACCOUNT_PASSWORD })
    })
  )

  const [account] = await database
    .select({ twoFactorEnabled: users.twoFactorEnabled })
    .from(users)
    .where(eq(users.id, userId))
  const factors = await database.select().from(twoFactors).where(eq(twoFactors.userId, userId))
  const entries = await database
    .select({ actorUserId: auditLogs.actorUserId })
    .from(auditLogs)
    .where(eq(auditLogs.event, "auth.totp.disable_refused"))

  expect(response.status).toBe(403)
  expect(account?.twoFactorEnabled).toBe(true)
  expect(factors).toHaveLength(1)
  expect(entries).toEqual([{ actorUserId: userId }])
})
