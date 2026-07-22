import { createRequire } from "node:module"

import { type BrowserContext } from "@playwright/test"

import { makeSignature } from "better-auth/crypto"

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
const require = createRequire(import.meta.url)

export async function addOwnerSessionCookie(
  context: BrowserContext,
  baseURL: string
): Promise<void> {
  const { loadEnvConfig } = require("@next/env") as typeof import("@next/env")

  loadEnvConfig(process.cwd())

  const { eq } = await import("drizzle-orm")

  const [{ auth }, { database }, { members }] = await Promise.all([
    import("@/lib/auth"),
    import("@/database"),
    import("@/database/schema")
  ])

  const owner = await database.query.members.findFirst({
    where: eq(members.role, "owner"),
    columns: { userId: true }
  })

  if (!owner) {
    throw new Error(
      "No owner account found. Register and complete setup on this instance before running the template editor e2e specs."
    )
  }

  const ctx = await auth.$context
  const session = await ctx.internalAdapter.createSession(owner.userId)
  const signature = await makeSignature(session.token, ctx.secret)

  const attrs = ctx.authCookies.sessionToken.attributes

  const expiresTimestamp = attrs.expires
    ? Math.floor(attrs.expires.getTime() / 1000)
    : Math.floor(Date.now() / 1000) + (attrs.maxAge ?? 60 * 60 * 24 * 30)

  await context.addCookies([
    {
      name: ctx.authCookies.sessionToken.name,
      value: `${session.token}.${signature}`,
      domain: new URL(baseURL).hostname,
      path: attrs.path,
      httpOnly: attrs.httpOnly,
      secure: attrs.secure,
      sameSite: toPlaywrightSameSite(attrs.sameSite),
      expires: expiresTimestamp
    }
  ])
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
