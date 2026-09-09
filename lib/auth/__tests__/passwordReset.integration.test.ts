import { eq } from "drizzle-orm"

import { beforeEach, expect, test, vi } from "vitest"

import { auth } from "@/lib/auth"

import { users } from "@/database/schema"

import { generateTotpCode } from "@/tests/e2e/support/totp"
import { database } from "@/tests/integration/database"

const mocks = vi.hoisted(() => ({
  sendTransactionalEmail: vi.fn(async () => null)
}))

// The mail provider is the only thing stubbed, and it is what makes the reset link observable:
// Better Auth stores the token hashed, so nothing in the database can hand it back. Capturing the
// message the transport was given reads exactly what the recipient would have read, without a
// test-only branch anywhere in the application.
vi.mock("@/features/email/server", () => ({
  isEmailConfigured: () => true,
  sendTransactionalEmail: mocks.sendTransactionalEmail
}))

const ACCOUNT_EMAIL = "reset-flow@example.test"
const ORIGINAL_PASSWORD = "OriginalPassword123!"
const REPLACEMENT_PASSWORD = "ReplacementPassword456!"

type SentMail = { to: string; text: string }

// The link Better Auth mails points at `/api/auth/reset-password/<token>?callbackURL=...`, which
// validates the token and then redirects to the callback carrying it as `?token=`. The last path
// segment is therefore the same value `app/(auth)/reset-password/page.tsx` reads from its search
// params, which is what lets this test hand it straight to `resetPassword`.
function readResetToken(): string {
  const calls = mocks.sendTransactionalEmail.mock.calls as unknown as [SentMail][]
  const sent = calls.at(-1)?.[0]

  if (!sent) throw new Error("No reset email was sent")

  const match = /https?:\/\/\S+/.exec(sent.text)

  if (!match) throw new Error("The reset email carried no link")

  const token = new URL(match[0]).pathname.split("/").at(-1)

  if (!token) throw new Error("The reset link carried no token")

  return token
}

async function enrolTwoFactor(headers: Headers): Promise<void> {
  const { totpURI } = await auth.api.enableTwoFactor({
    headers,
    body: { password: ORIGINAL_PASSWORD }
  })

  const secret = new URL(totpURI).searchParams.get("secret")

  if (!secret) throw new Error("Better Auth returned a TOTP URI with no secret parameter")

  await auth.api.verifyTOTP({ headers, body: { code: generateTotpCode(secret) } })
}

beforeEach(() => {
  mocks.sendTransactionalEmail.mockClear()
})

// Canonical flow 5 from .agents/rules/testing.md. It lives here rather than under `tests/e2e/`
// because Remit has exactly one user by construction (ADR-0002): a Playwright reset would change
// the credential of the sole owner that every other spec authenticates as, and on a developer's own
// instance that owner is a real account whose password cannot be put back. This suite creates the
// account it resets, against a database truncated before every test.
test("replaces the password through the emailed link and still demands the second factor", async () => {
  const signUp = await auth.api.signUpEmail({
    body: { email: ACCOUNT_EMAIL, password: ORIGINAL_PASSWORD, name: "Reset Flow" },
    returnHeaders: true
  })

  const sessionCookie = signUp.headers.get("set-cookie")

  if (!sessionCookie) throw new Error("Sign-up returned no session cookie")

  await enrolTwoFactor(new Headers({ cookie: sessionCookie }))

  await auth.api.requestPasswordReset({
    body: { email: ACCOUNT_EMAIL, redirectTo: "http://localhost:3000/reset-password" }
  })

  await auth.api.resetPassword({
    body: { newPassword: REPLACEMENT_PASSWORD, token: readResetToken() }
  })

  const signIn = await auth.api.signInEmail({
    body: { email: ACCOUNT_EMAIL, password: REPLACEMENT_PASSWORD }
  })

  // ADR-0003: no reset path is a way past the second factor. A successful credential check hands
  // back the two-factor redirect rather than a session, which is the whole assertion here.
  expect(signIn).toMatchObject({ twoFactorRedirect: true })

  await expect(
    auth.api.signInEmail({ body: { email: ACCOUNT_EMAIL, password: ORIGINAL_PASSWORD } })
  ).rejects.toThrow()

  // The self-service path leaves the flag alone; only the operator CLI sets it, because only there
  // does somebody other than the account holder choose the password (ADR-0012).
  const [account] = await database
    .select({ mustChangePassword: users.mustChangePassword })
    .from(users)
    .where(eq(users.email, ACCOUNT_EMAIL))

  expect(account?.mustChangePassword).toBe(false)
})
