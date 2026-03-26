import { NextRequest, NextResponse } from "next/server"

import { getSessionCookie } from "better-auth/cookies"

// Cookie presence is optimistic only — does not validate the session.
// Every protected layout and page must call auth.api.getSession({ headers: await headers() })
// and handle the null case.

export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request)
  const { pathname } = request.nextUrl

  if (!sessionCookie && isProtectedRoute(pathname)) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  if (sessionCookie && isAuthRoute(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return NextResponse.next()
}

function isProtectedRoute(pathname: string): boolean {
  const protectedPrefixes = [
    "/dashboard",
    "/clients",
    "/projects",
    "/proposals",
    "/invoices",
    "/templates",
    "/settings"
  ]
  return protectedPrefixes.some((prefix) => pathname.startsWith(prefix))
}

function isAuthRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/setup")
  )
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|logo.png).*)"]
}
