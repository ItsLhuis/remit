import { NextResponse, type NextRequest } from "next/server"

// Shared by the two OTP route handlers beside this file. `proxy.ts` already stamps
// `X-Robots-Tag` on everything under `/p/`, and this sets it again at the handler: the proxy
// matcher is one edit away from not covering a path, and a public token response that reaches a
// crawler is not recoverable once indexed.
export function noindexJson(body: unknown, status: number): NextResponse {
  const response = NextResponse.json(body, { status })

  response.headers.set("X-Robots-Tag", "noindex, nofollow")

  return response
}

// A malformed body becomes `null` rather than a thrown parse error, so it falls through to the
// same Zod rejection as a well-formed body with the wrong fields.
export async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}
