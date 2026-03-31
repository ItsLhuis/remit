import { NextRequest, NextResponse } from "next/server"

import { auth } from "@/lib/auth"

// Cookie presence is optimistic only — does not validate the session.
// Every protected layout and page must call auth.api.getSession({ headers: await headers() })
// and handle the null case.

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isStaticAsset(pathname) || isPublicApiRoute(pathname) || isPublicAppRoute(pathname)) {
    return NextResponse.next()
  }

  const setupDone = request.cookies.has("remit_setup")

  if (!setupDone) {
    if (pathname !== "/setup") {
      return NextResponse.redirect(new URL("/setup", request.url))
    }

    return NextResponse.next()
  }

  if (pathname === "/setup") {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  if (pathname.startsWith("/login")) {
    const session = await auth.api.getSession({ headers: request.headers })

    if (session) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }

    return NextResponse.next()
  }

  const session = await auth.api.getSession({ headers: request.headers })

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url))
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
