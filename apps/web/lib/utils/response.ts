// The JSON response of every public token route and anonymous download route (`security.md`).
// `proxy.ts` stamps `X-Robots-Tag` on the token paths it matches and not on `/api/`, so this header is
// the only one an `/api/` route sends and a second one on a token route: the proxy matcher is one
// edit away from not covering a path, and a response that reaches a crawler is not recoverable once
// indexed.
//
// Built on the web `Response` rather than `NextResponse`, because this barrel is also imported by
// client components and `next/server` has no place in a browser bundle; the bytes, status and headers
// are the same either way.
export function noindexJson(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: { "X-Robots-Tag": "noindex, nofollow" }
  })
}
