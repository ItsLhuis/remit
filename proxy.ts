import { type NextRequest, NextResponse } from "next/server"

import { eq } from "drizzle-orm"

import { auth } from "@/lib/auth"

import { writeAudit } from "@/lib/audit"

import { rateLimitInstance } from "@/lib/rateLimit"

import { database } from "@/database"
import { settings, users } from "@/database/schema"

export function buildContentSecurityPolicy(): string {
  const storageOrigin = (() => {
    try {
      const raw = process.env.NEXT_PUBLIC_STORAGE_BASE_URL

      return raw ? new URL(raw).origin : null
    } catch {
      return null
    }
  })()

  const connectSrc = storageOrigin ? `connect-src 'self' ${storageOrigin}` : "connect-src 'self'"
  const imgSrc = storageOrigin
    ? `img-src 'self' data: blob: https://react-circle-flags.pages.dev ${storageOrigin}`
    : "img-src 'self' data: blob: https://react-circle-flags.pages.dev"

  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    imgSrc,
    "font-src 'self'",
    connectSrc,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join("; ")
}

const CONTENT_SECURITY_POLICY = buildContentSecurityPolicy()

export function applySecurityHeaders(
  response: NextResponse,
  isPublicTokenRoute: boolean
): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
  response.headers.set("Content-Security-Policy", CONTENT_SECURITY_POLICY)

  if (isPublicTokenRoute) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow")
    response.headers.delete("X-Frame-Options")
  } else {
    response.headers.set("X-Frame-Options", "DENY")
  }

  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    )
  }

  return response
}

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
    const ipAddress = getIpAddress(request)
    const rateLimitResult = await rateLimitInstance.consume(ipAddress, 60, 60000)

    if (!rateLimitResult.allowed) {
      await writeAudit("auth.rate_limit.tripped", {
        ipAddress,
        metadata: { route: pathname }
      })

      return applySecurityHeaders(new NextResponse("Too many requests", { status: 429 }), true)
    }

    return applySecurityHeaders(NextResponse.next(), true)
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

function getIpAddress(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()

  return forwardedFor || request.headers.get("x-real-ip") || "unknown"
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

function isPublicApiRoute(pathname: string): boolean {
  return pathname === "/api/health" || pathname.startsWith("/api/auth/")
}

function isPublicTokenRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/i/") ||
    pathname.startsWith("/p/") ||
    pathname.startsWith("/c/") ||
    pathname.startsWith("/s/")
  )
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.png|login.jpg|.*\\..*).*)"]
}
