---
paths:
  - "app/**/route.ts"
---

# API Route Rules

API route handlers under `app/**/route.ts` are the narrow exception to the server-action write path.
They exist only for public anonymous token routes, webhooks, health and metrics, and explicitly
justified public API surfaces (see `AGENTS.md`). Anything a logged-in user does from the app is a
server action in `mutations.ts`, not a route. Canonical exemplars: `app/api/health/route.ts` and
`app/api/upload/[type]/route.ts`.

## Handler shape

Export HTTP-method functions (`GET`, `POST`, ...) as named `async function` declarations that return
a `Response`, built with `NextResponse.json(...)` and an explicit status code. Declare route segment
config (`export const dynamic`, `revalidate`) above the handler when the route needs it.

```ts
export const dynamic = "force-dynamic"

export async function GET(): Promise<Response> {
  const result = await checkDatabaseConnectivity()

  if (!result.ok) {
    logger.error({ action: "api.health.GET", reason: result.reason }, "Public health check failed")

    return NextResponse.json({ ok: false, reason: result.reason }, { status: 503 })
  }

  return NextResponse.json({ ok: true, version: pkg.version })
}
```

## Validation and authorization order

Validate every untrusted input — body, params, and query — with a Zod schema using `safeParse`.
Resolve the dynamic `params` promise, look up any route variant, check the session via
`auth.api.getSession`, then validate the body. Return the first issue message on validation failure.

| Condition                          | Status |
| ---------------------------------- | ------ |
| Unknown route variant or not found | `404`  |
| No session when one is required    | `401`  |
| Invalid input                      | `400`  |
| Unexpected IO failure              | `500`  |

```ts
const parsed = config.schema.safeParse(await request.json())

if (!parsed.success) {
  return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
}
```

## Errors and logging

Routes never throw to the client. Wrap fallible IO in a focused `try`/`catch`, log the failure with
`logger.error` and structured context, and return a translated message with a `5xx` status. Error
strings are translated server-side with `t` from `@/lib/i18n/server` (see `errors.md`, `i18n.md`).

## Security

Token generation and comparison, rate limiting, `noindex` headers, audit logging, and request
metadata via `getIpAddress` are mandatory for the relevant routes and are specified in
`security.md`. Do not parse forwarded headers inline.
