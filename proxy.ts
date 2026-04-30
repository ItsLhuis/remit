import { NextRequest, NextResponse } from "next/server"

import { auth } from "@/lib/auth"

import { database } from "@/database"
import { settings, users } from "@/database/schema"

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isStaticAsset(pathname) || isPublicApiRoute(pathname) || isPublicAppRoute(pathname)) {
    return NextResponse.next()
  }

  const existingUser = await database
    .select({ id: users.id })
    .from(users)
    .limit(1)
    .then((rows) => rows[0] ?? null)

  if (!existingUser) {
    if (pathname !== "/register") {
      return NextResponse.redirect(new URL("/register", request.url))
    }
    return NextResponse.next()
  }

  const session = await auth.api.getSession({ headers: request.headers })

  if (pathname === "/register") {
    return NextResponse.redirect(new URL(session ? "/setup" : "/login", request.url))
  }

  if (!session) {
    if (pathname.startsWith("/login")) {
      return NextResponse.next()
    }

    return NextResponse.redirect(new URL("/login", request.url))
  }

  if (pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/setup", request.url))
  }

  const userSettings = await database
    .select({ businessName: settings.businessName })
    .from(settings)
    .limit(1)
    .then((rows) => rows[0] ?? null)

  const setupComplete = !!(userSettings?.businessName && session.user.twoFactorEnabled)

  if (!setupComplete) {
    if (pathname === "/setup" || pathname.startsWith("/api/setup/")) {
      return NextResponse.next()
    }

    return NextResponse.redirect(new URL("/setup", request.url))
  }

  if (pathname === "/setup") {
    return NextResponse.redirect(new URL("/", request.url))
  }

  return NextResponse.next()
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
  return pathname.startsWith("/api/auth/")
}

function isPublicAppRoute(pathname: string): boolean {
  return pathname.startsWith("/i/") || pathname.startsWith("/p/")
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.png|login.jpg|.*\\..*).*)"]
}
