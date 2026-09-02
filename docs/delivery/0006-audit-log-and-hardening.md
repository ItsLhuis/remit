# DR-0006: Security audit log and HTTP hardening

- **Status:** Shipped
- **Date:** 2026-05-08
- **Verdict:** Complete with known gaps
- **Decisions:** ADR-0001
- **Supersedes:** —
- **Reconstructed:** yes

## What

An append-only security audit log separate from the user-facing activity feed, the HTTP security
headers applied to every response, and the rate limiter guarding authentication and public token
endpoints.

## Why

An instance that cannot say who changed the Stripe key, when a public token was used, or how many
failed logins preceded a successful one cannot be investigated after the fact. The user-facing
activity feed is the wrong place for that: it is filtered, it is deletable in spirit, and it exists
to tell a freelancer what happened to their records, not to tell an investigator what happened to
their instance.

## Scope

Included: the `audit_logs` table with actor, role, target entity, JSONB metadata, IP address and
user-agent; the `writeAudit` helper every sensitive path calls; the shared `getIpAddress` request
helper; the security headers set in `proxy.ts`; and a pluggable rate limiter with an in-memory
adapter applied to the authentication endpoints and the public token routes.

Excluded: any update or delete path for `audit_logs`. The table is insert-only and the guard is a
database trigger rather than a convention, so a future mutation cannot quietly acquire one. Also
excluded is a Redis-backed rate limiter, which matters only for multi-instance deployments.

## How

The insert-only property is enforced by `0001_insert_only_guards.sql` rather than by application
code, because a rule that lives only in the call sites is a rule that holds until someone writes a
new call site. This is one of the two hand-written migrations in the repository.

`getIpAddress(headers)` in `lib/utils/request.ts` is shared rather than reimplemented per route
deliberately: forwarded-header parsing is exactly the kind of thing that gets subtly wrong in one of
five copies, and the wrong copy is the one attributing an action to the proxy instead of the client.

The security headers are set in `proxy.ts` for every response, including the ones a route handler
never sees. `X-Frame-Options` is dropped on the public document routes on purpose — an invoice a
client embeds is a supported use — and the file carries a comment saying so, because the deletion
otherwise reads as a mistake.

Rate limiting is behind an adapter interface with an in-memory implementation, so the
single-instance default needs no Redis while a multi-instance deployment has somewhere to plug one
in.

## Evidence

- `database/schema/auditLogs.ts`, `drizzle/migrations/0001_insert_only_guards.sql`
- `lib/audit/index.ts` — `writeAudit` and the `AuditEvent` union
- `lib/utils/request.ts` — `getIpAddress`
- `proxy.ts` — Content-Security-Policy, HSTS, `X-Frame-Options` and the public-route exception
- `lib/rateLimit/index.ts`, `lib/rateLimit/inMemoryAdapter.ts`, `lib/rateLimit/types.ts`
- Consumers: `lib/auth/index.ts`, `app/(public)/p/[token]/otp/request/route.ts`,
  `app/(public)/p/[token]/otp/verify/route.ts`, `app/(public)/c/[token]/sign/route.ts`,
  `app/api/webhooks/stripe/route.ts`
- `.agents/rules/security.md` — the required audit fields and the covered flows

## Verification

`lib/audit/__tests__/writeAudit.test.ts` covers the writer, and
`lib/utils/__tests__/request.test.ts` covers forwarded-header parsing across the proxy chain, the
whitespace trim, the fallback header, and the present-but-empty and missing cases — the last two
because an empty header must fall through rather than be returned as an empty address. The rate
limiter is exercised through the public token route tests in
`app/(public)/p/[token]/otp/__tests__/otpRoutes.test.ts` and
`app/(public)/c/[token]/sign/__tests__/signRoute.test.ts`, which assert the limited response rather
than the limiter's internals. The insert-only guards are enforced by database triggers, so they hold
against any writer rather than against the ones a test happens to exercise.

Not covered: that every flow the security rules list as audit-covered actually writes an entry. That
correspondence is maintained by review.

## Known gaps

The rate limiter has only an in-memory adapter, so limits are per-process; the architecture
describes a Redis adapter for multi-instance deployments and none exists. Public token rotation is
listed among the audited flows and no rotation path exists to audit.
