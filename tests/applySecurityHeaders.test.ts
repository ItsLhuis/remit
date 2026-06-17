import { NextRequest, NextResponse } from "next/server"

import { afterEach, describe, expect, test, vi } from "vitest"

import { applySecurityHeaders, buildContentSecurityPolicy, proxy } from "../proxy"

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

describe("applySecurityHeaders", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

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

  test("includes storage origin in connect-src and img-src when NEXT_PUBLIC_STORAGE_BASE_URL is set", () => {
    vi.stubEnv("NEXT_PUBLIC_STORAGE_BASE_URL", "http://localhost:9000/remit")

    const csp = buildContentSecurityPolicy()

    expect(csp).toContain("connect-src 'self' http://localhost:9000")
    expect(csp).toContain(
      "img-src 'self' data: blob: https://react-circle-flags.pages.dev http://localhost:9000"
    )
  })

  test("omits storage origin from connect-src and img-src when NEXT_PUBLIC_STORAGE_BASE_URL is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_STORAGE_BASE_URL", "")

    const csp = buildContentSecurityPolicy()

    expect(csp).toContain("connect-src 'self'")
    expect(csp).not.toContain("connect-src 'self' http")
    expect(csp).toContain("img-src 'self' data: blob: https://react-circle-flags.pages.dev")
    expect(csp).not.toContain(
      "img-src 'self' data: blob: https://react-circle-flags.pages.dev http"
    )
  })
})
