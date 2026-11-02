# Two-factor authentication

A TOTP second factor protects every Remit account, for every role. An account holder cannot turn it
off, whatever the role and even with the correct password.

## Status

draft

## Requirements

### Requirement: TOTP cannot be disabled

The system SHALL answer every `POST /api/auth/two-factor/disable` with `403` and the translated
forbidden message, and SHALL leave the account's factor untouched.

#### Scenario: A session of any role

- WHEN a session of an owner, an accountant or an assistant posts to the disable route
- THEN the response is `403` with the forbidden message and Better Auth's handler never runs

#### Scenario: No session

- WHEN a caller with no session posts to the disable route
- THEN the response is the same `403` with the same body and Better Auth's handler never runs

#### Scenario: A refusal is audited once per window

- WHEN refusals repeat from one address inside a window
- THEN one `auth.totp.disable_refused` entry is written, carrying the session user when there is one
  and the count the previous window suppressed, and the rest write nothing and read no session

#### Scenario: Other two-factor routes are untouched

- WHEN a caller posts to enable, verify-totp, verify-backup-code or generate-backup-codes
- THEN the request reaches Better Auth's handler

Enforced by: `app/api/auth/[...all]/__tests__/route.test.ts`

## How it works

`POST` in `app/api/auth/[...all]/route.ts` matches the path suffix `/two-factor/disable` before it
reads the body, and answers from `refuseTwoFactorDisable`. That function counts the refusal with
`countRateLimitTrip` (`lib/rateLimit/tripCounter.ts`) and writes the audit entry only when the count
says so. A session read that fails is logged and the entry is written without an actor; the response
stays `403`.

Better Auth's router matches a path byte for byte and answers `404` for a trailing slash, an encoded
byte, a changed case or a doubled slash, so the one spelling that runs the endpoint is the one
refused.

## Decisions

### D1: The refusal is `403` with the forbidden message, the same for every caller

The route never asks who is calling before it refuses, so no session changes the answer. Rejected:
`404`, because the route is known and refused; `401`, because signing in would not change the
answer.

### D2: The refusal's audit is windowed per address

One entry per address per 15 minutes, carrying the count the previous window suppressed. The route
is reachable without a session and sits before Better Auth's limiter, so the session is read only
when an entry is written and a flood from one address costs one Redis round trip per request. The
trip key is a fixed string plus the address, because the suffix match accepts caller-chosen
prefixes. The bound is per address, and the address comes from `getIpAddress`, which trusts
`X-Forwarded-For`: it holds where a reverse proxy overwrites that header (`docs/deploy/nginx.md`
does), and a caller reaching the app directly can vary it. Rejected: a row per request, because an
anonymous caller could flood the insert-only `audit_logs`; the pathname in the key, because a caller
could then mint a fresh window per request.

## Known limits

- GAP-4: The audit of a refused disable is bounded per address, and a caller reaching the app
  directly can vary `X-Forwarded-For`, so the bound holds only behind a reverse proxy that
  overwrites that header (owner: see `openspec/backlog.md`)
