import { type BrowserContext } from "@playwright/test"

import { makeSignature } from "better-auth/crypto"

import { eq } from "drizzle-orm"

import { loadAppContext } from "./appContext"

// The canvas editor lives behind the authenticated dashboard, and Remit is
// structurally single-instance (one owner, registered once). auth.spec.ts already documents that
// Better Auth has no test bypass for completing TOTP verification through the UI, so a from-scratch
// registration flow cannot reach an authenticated session in an automated run. Rather than resetting
// the existing owner's real password (a destructive, unrelated side effect on a dev credential) or
// hand-writing a session row directly into a Better Auth-owned table, this helper calls Better
// Auth's own session-issuing primitive (`ctx.internalAdapter.createSession`) through the app's real
// `auth` context — the same mechanism Better Auth ships as its official `test-utils` plugin
// (`better-auth/plugins` -> `testUtils()` -> `ctx.test.login`) for exactly this purpose. It only adds
// a new session for the existing owner; it never touches their password or two-factor state.
type OwnerSessionCookie = {
  name: string
  value: string
  path: string | undefined
  httpOnly: boolean | undefined
  secure: boolean | undefined
  sameSite: "Strict" | "Lax" | "None"
  expires: number
}

export async function addOwnerSessionCookie(
  context: BrowserContext,
  baseURL: string
): Promise<void> {
  const userId = await getOwnerUserId()
  const cookie = await createOwnerSessionCookie(userId)

  await context.addCookies([{ ...cookie, domain: new URL(baseURL).hostname }])
}

export async function getOwnerUserId(): Promise<string> {
  const { database, schema } = await loadAppContext()

  const owner = await database.query.members.findFirst({
    where: eq(schema.members.role, "owner"),
    columns: { userId: true }
  })

  if (!owner) {
    throw new Error(
      "No owner account found. Register and complete setup on this instance before running the template editor e2e specs."
    )
  }

  return owner.userId
}

export async function createOwnerSessionCookie(userId: string): Promise<OwnerSessionCookie> {
  const { auth } = await loadAppContext()

  const ctx = await auth.$context
  const session = await ctx.internalAdapter.createSession(userId)
  const signature = await makeSignature(session.token, ctx.secret)

  const attrs = ctx.authCookies.sessionToken.attributes

  const expiresTimestamp = attrs.expires
    ? Math.floor(attrs.expires.getTime() / 1000)
    : Math.floor(Date.now() / 1000) + (attrs.maxAge ?? 60 * 60 * 24 * 30)

  return {
    name: ctx.authCookies.sessionToken.name,
    value: `${session.token}.${signature}`,
    path: attrs.path,
    httpOnly: attrs.httpOnly,
    secure: attrs.secure,
    sameSite: toPlaywrightSameSite(attrs.sameSite),
    expires: expiresTimestamp
  }
}

// Better Auth cookie attributes (better-call CookieOptions) allow lowercase sameSite values;
// Playwright's addCookies accepts only the capitalized forms.
function toPlaywrightSameSite(
  sameSite: "Strict" | "Lax" | "None" | "strict" | "lax" | "none" | undefined
): "Strict" | "Lax" | "None" {
  if (sameSite === "strict" || sameSite === "Strict") return "Strict"
  if (sameSite === "none" || sameSite === "None") return "None"

  return "Lax"
}
