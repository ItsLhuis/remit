import { NextRequest, NextResponse } from "next/server"

import { describe, expect, test, vi } from "vitest"

import { applySecurityHeaders, buildContentSecurityPolicy } from "@/lib/securityHeaders"

import { config, proxy } from "../proxy"

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn()
    }
  }
}))

vi.mock("@/database", () => ({
  database: {}
}))

vi.mock("@/database/schema", () => ({
  settings: {},
  users: {}
}))

function isHandledByProxy(pathname: string): boolean {
  return config.matcher.some((pattern) => new RegExp(`^${pattern}$`).test(pathname))
}

describe("applySecurityHeaders", () => {
  test("sets baseline security headers and frame denial on non-public-token routes", () => {
    const response = NextResponse.next()

    applySecurityHeaders(response, false)

    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff")
    expect(response.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin")
    expect(response.headers.get("Permissions-Policy")).toBe(
      "camera=(), microphone=(), geolocation=()"
    )
    expect(response.headers.get("Content-Security-Policy")).toContain("default-src 'self'")
    expect(response.headers.get("X-Frame-Options")).toBe("DENY")
    expect(response.headers.get("X-Robots-Tag")).toBeNull()
  })

  test("sets robots protection and omits frame denial on public-token routes", () => {
    const response = NextResponse.next()

    applySecurityHeaders(response, true)

    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow")
    expect(response.headers.get("X-Frame-Options")).toBeNull()
  })

  test("applies baseline headers to public API pass-through routes", async () => {
    const response = await proxy(new NextRequest("https://remit.test/api/health"))

    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff")
    expect(response.headers.get("X-Frame-Options")).toBe("DENY")
  })

  // Stored files are served from this origin, so a storage host in the policy would be an address
  // frozen in at build time rather than one the deployment chose.
  test("allows connections and images from this origin only apart from the flag images", () => {
    const directives = buildContentSecurityPolicy().split("; ")

    expect(directives).toContain("connect-src 'self'")
    expect(directives).toContain("img-src 'self' data: blob: https://react-circle-flags.pages.dev")
  })
})

describe("proxy matcher", () => {
  test("handles application pages and API routes", () => {
    expect(isHandledByProxy("/")).toBe(true)
    expect(isHandledByProxy("/settings/profile")).toBe(true)
    expect(isHandledByProxy("/api/health")).toBe(true)
  })

  // A request the proxy handles has its body buffered and cut off at ten megabytes, so an upload
  // routed through it would be stored truncated rather than refused.
  test("leaves uploads to the upload route so their bodies are never buffered", () => {
    expect(isHandledByProxy("/api/upload/attachment")).toBe(false)
  })

  test("leaves stored files to the anonymous storage route", () => {
    expect(isHandledByProxy("/api/storage/avatars/user-1/photo")).toBe(false)
  })
})
