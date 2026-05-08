import { NextRequest, NextResponse } from "next/server"
import { describe, expect, test, vi } from "vitest"

import { applySecurityHeaders, proxy } from "../proxy"

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
})
