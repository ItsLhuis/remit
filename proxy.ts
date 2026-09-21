import { type NextRequest, NextResponse } from "next/server"

import { eq } from "drizzle-orm"

import { auth } from "@/lib/auth"

import { writeAudit } from "@/lib/audit"

import { getIpAddress } from "@/lib/utils"

import { rateLimitInstance } from "@/lib/rateLimit"
import { applySecurityHeaders } from "@/lib/securityHeaders"

import { database } from "@/database"
import { members, settings, users } from "@/database/schema"

// The onboarding and authentication state machine below derives every routing decision from the
// database and the active session, and from nothing else. Storing routing state in a cookie is a
// violation of the rule in `.agents/rules/security.md` and ARCHITECTURE.md's "Routing state rule"
// (ADR-0001), however tempting it is as a way to avoid the per-request reads here. The guard order
// is the state machine itself: user existence, then session, then setup completion, then an
// organization membership, then a forced password change; each stage may only be reached once the
// earlier ones are satisfied.

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isPublicToken = isPublicTokenRoute(pathname)

  if (isStaticAsset(pathname)) {
    return NextResponse.next()
  }

  if (isPublicApiRoute(pathname)) {
    return applySecurityHeaders(NextResponse.next(), false)
  }

  if (isPublicToken) {
    const ipAddress = getIpAddress(request.headers) || "unknown"
    const rateLimitResult = await rateLimitInstance.consume(ipAddress, 60, 60000)

    if (!rateLimitResult.allowed) {
      await writeAudit("auth.rate_limit.tripped", {
        ipAddress,
        metadata: { route: getPublicTokenRouteLabel(pathname) }
      })

      return applySecurityHeaders(new NextResponse("Too many requests", { status: 429 }), true)
    }

    return applySecurityHeaders(NextResponse.next(), true)
  }

  // Deliberately ahead of every guard below, and the only route that sits outside the state machine
  // while still being part of it. An invitee arrives with no session (so the login redirect would
  // swallow the invitation id), and immediately after signing up they have a session that is not
  // setup-complete (so the `/setup` redirect would swallow the server action that accepts the
  // invitation, since a server action POSTs to the page it was called from). The page itself is
  // safe to reach anonymously: it reveals only the invited address and organization name, and
  // `acceptTeamInvitation` refuses any session whose email is not the invited one. Accepting hands
  // the invitee straight back into the machine, which routes them to `/setup` for TOTP.
  if (isInvitationRoute(pathname)) {
    const ipAddress = getIpAddress(request.headers) || "unknown"
    const rateLimitResult = await rateLimitInstance.consume(`invite:${ipAddress}`, 30, 60000)

    if (!rateLimitResult.allowed) {
      await writeAudit("auth.rate_limit.tripped", {
        ipAddress,
        metadata: { route: "/invite/[invitationId]" }
      })

      return withNoIndex(
        applySecurityHeaders(new NextResponse("Too many requests", { status: 429 }), false)
      )
    }

    return withNoIndex(applySecurityHeaders(NextResponse.next(), false))
  }

  const existingUser = await database
    .select({ id: users.id })
    .from(users)
    .limit(1)
    .then((rows) => rows[0] ?? null)

  if (!existingUser) {
    if (pathname !== "/register") {
      return applySecurityHeaders(NextResponse.redirect(new URL("/register", request.url)), false)
    }

    return applySecurityHeaders(NextResponse.next(), false)
  }

  const session = await auth.api.getSession({ headers: request.headers })

  if (pathname === "/register") {
    return applySecurityHeaders(
      NextResponse.redirect(new URL(session ? "/setup" : "/login", request.url)),
      false
    )
  }

  if (!session) {
    if (pathname.startsWith("/login")) {
      return applySecurityHeaders(NextResponse.next(), false)
    }

    return applySecurityHeaders(NextResponse.redirect(new URL("/login", request.url)), false)
  }

  if (pathname.startsWith("/login")) {
    return applySecurityHeaders(NextResponse.redirect(new URL("/setup", request.url)), false)
  }

  const userSettings = await database
    .select({ businessName: settings.businessName })
    .from(settings)
    .limit(1)
    .then((rows) => rows[0] ?? null)

  // "Setup complete" is exactly these two facts, and the setup wizard in `features/setup` must
  // keep writing both: a business name on the settings row and an enrolled TOTP factor. Adding a
  // step to the wizard without extending this predicate lets a user escape it by navigating away.
  const setupComplete = !!(userSettings?.businessName && session.user.twoFactorEnabled)

  if (!setupComplete) {
    if (pathname === "/setup" || pathname.startsWith("/api/setup/")) {
      return applySecurityHeaders(NextResponse.next(), false)
    }

    return applySecurityHeaders(NextResponse.redirect(new URL("/setup", request.url)), false)
  }

  if (pathname === "/setup") {
    return applySecurityHeaders(NextResponse.redirect(new URL("/", request.url)), false)
  }

  // A session with no membership has no role, so `getCurrentRole` resolves to null and every page
  // and mutation already refuses it. What survives that is the shell: the user reaches the dashboard
  // chrome and an empty application. Removing a member deletes the membership and deliberately keeps
  // the `users` row — `audit_logs.actor_user_id` still references it — so their password goes on
  // authenticating, and this is what turns that surviving login into a clean refusal.
  //
  // Placed after the setup gate on purpose: the first owner has no membership until
  // `features/setup`'s `saveBusinessProfile` creates the organization, so checking any earlier would
  // bounce them out of their own registration.
  if (!(await hasMembership(session.user.id))) {
    return clearSessionAndRedirectToLogin(request)
  }

  const mustChangePassword = await getMustChangePassword(session.user.id)

  if (mustChangePassword) {
    if (pathname.startsWith("/change-password")) {
      return applySecurityHeaders(NextResponse.next(), false)
    }

    return applySecurityHeaders(
      NextResponse.redirect(new URL("/change-password", request.url)),
      false
    )
  }

  if (pathname.startsWith("/change-password")) {
    return applySecurityHeaders(NextResponse.redirect(new URL("/", request.url)), false)
  }

  return applySecurityHeaders(NextResponse.next(), false)
}

async function hasMembership(userId: string): Promise<boolean> {
  const member = await database
    .select({ id: members.id })
    .from(members)
    .where(eq(members.userId, userId))
    .limit(1)
    .then((rows) => rows[0] ?? null)

  return member !== null
}

// The cookie has to go, not just the route: `/login` sends a live session on to `/setup` and then
// back to `/`, so redirecting a still-authenticated request there loops forever. Clearing it is also
// what makes the bounce survive the session cookie cache, which would otherwise keep answering with
// the old session for up to five minutes. The names come from Better Auth so the `__Secure-` prefix
// it adds in production is not restated here. Revoking the underlying rows is deliberately not done
// here — a proxy routes, and `removeTeamMember` already revokes at the moment membership ends.
async function clearSessionAndRedirectToLogin(request: NextRequest): Promise<NextResponse> {
  const response = applySecurityHeaders(
    NextResponse.redirect(new URL("/login", request.url)),
    false
  )

  const { authCookies } = await auth.$context

  response.cookies.delete(authCookies.sessionToken.name)
  response.cookies.delete(authCookies.sessionData.name)

  return response
}

async function getMustChangePassword(userId: string): Promise<boolean> {
  const user = await database
    .select({ mustChangePassword: users.mustChangePassword })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
    .then((rows) => rows[0] ?? null)

  return user?.mustChangePassword ?? false
}

function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/logo.png" ||
    pathname === "/login.jpg" ||
    /\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml|woff2?|ttf|eot)$/i.test(pathname)
  )
}

// Webhook receivers are anonymous by construction: the caller is a payment provider, never a session.
// Without this the session check below rewrites the delivery to the login page and answers 200, which
// Stripe reads as a successful delivery and never retries — the event would be lost silently. Each
// receiver authenticates its own caller instead, by signature (`features/payments/stripeWebhook.ts`).
// `/api/metrics` is here for the same reason: its caller is a Prometheus scraper holding a bearer
// token, never a session, and `lib/metrics/handleMetricsRequest.ts` owns its rate limit, its token
// check and its `noindex` header. `/api/v1/` likewise: its caller is an integration holding an API
// token, and `features/api/handleApiRequest.ts` owns its limits and its authentication — without
// this line every token request would be redirected to the login page. `/api/mcp` is the same
// caller through a second protocol, and `features/mcp/handleMcpRequest.ts` owns its Origin check,
// its switch, its limits and the same token authentication.
function isPublicApiRoute(pathname: string): boolean {
  return (
    pathname === "/api/health" ||
    pathname === "/api/metrics" ||
    pathname === "/api/mcp" ||
    pathname.startsWith("/api/v1/") ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/webhooks/")
  )
}

// The route template, never the pathname. On a public-token route the second segment *is* the
// token, and `audit_log` is readable by anyone with database access, so writing the raw path there
// would file a live bearer credential in the audit trail (`security.md`).
function getPublicTokenRouteLabel(pathname: string): string {
  const [, prefix] = pathname.split("/")

  return `/${prefix ?? ""}/[token]`
}

function isInvitationRoute(pathname: string): boolean {
  return pathname.startsWith("/invite/")
}

// Not `applySecurityHeaders(response, true)`: that branch is for the anonymous document routes,
// which also drop `X-Frame-Options` so an invoice can be embedded. An invitation page must stay
// unframeable — it carries a sign-up form — and only wants the crawler directive.
function withNoIndex(response: NextResponse): NextResponse {
  response.headers.set("X-Robots-Tag", "noindex, nofollow")

  return response
}

function isPublicTokenRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/i/") ||
    pathname.startsWith("/p/") ||
    pathname.startsWith("/c/") ||
    pathname.startsWith("/s/")
  )
}

// `api/upload/` is left out because a request the proxy handles has its body cloned into memory and
// cut off at ten megabytes (Next.js `proxyClientMaxBodySize`), silently truncating an attachment;
// that route checks its own session and sets its own headers. `api/storage/` is left out because it
// is anonymous and serves stored files, which the dotted-path exclusion already skips — naming it
// keeps the decision from resting on every key happening to carry an extension.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|api/upload/|api/storage/|favicon.ico|logo.png|login.jpg|.*\\..*).*)"
  ]
}
