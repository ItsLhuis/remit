import { type NextResponse } from "next/server"

// Shared by `proxy.ts` and by `app/api/upload/[type]/route.ts`, which the proxy's matcher leaves out
// so an upload body is streamed rather than buffered, and which must not lose the headers every other
// response carries as a result.
//
// Every source is `'self'` apart from the flag images: stored objects are served from this origin by
// `app/api/storage/[...key]/route.ts`, so the policy names no storage host and needs no configuration
// that could differ between the build and the deployment.
export function buildContentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    process.env.NODE_ENV === "production"
      ? "script-src 'self' 'unsafe-inline'"
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://react-circle-flags.pages.dev",
    "font-src 'self'",
    "connect-src 'self'",
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
