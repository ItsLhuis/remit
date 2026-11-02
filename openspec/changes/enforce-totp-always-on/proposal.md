# enforce-totp-always-on

## Product position

TOTP can never be disabled, for any role, yet `POST /api/auth/two-factor/disable` reaches Better
Auth's handler, which clears the factor for any session holding the account password. The only
reaction is the routing guard in `proxy.ts`, which forces re-enrolment after the session cookie
cache expires. The application refuses the request instead.

## Scope

- In: refuse `POST /api/auth/two-factor/disable` for every caller in
  `app/api/auth/[...all]/route.ts`, before Better Auth's handler; audit the refusal; tests;
  `.agents/rules/security.md` states the rule plainly; the first capability spec.
- Out: every other `/two-factor/*` route, Better Auth configuration, sessions, the routing guard,
  any UI (no Remit screen offers to turn TOTP off: `features/` and `components/` call only `enable`,
  `verifyTotp`, `verifyBackupCode` and `generateBackupCodes`).

## Capabilities touched

- `two-factor-authentication` (new, `openspec/specs/two-factor-authentication/spec.md`)

## Decisions

- The refusal is `403` with `{ "error": t("errors.forbidden") }`, the same for every caller with or
  without a session: the route never asks who is calling before refusing. `403` over `404` because
  the route is known and refused; over `401` because no session would change the answer.
- The audit event is `auth.totp.disable_refused`, carrying the session user when there is one, and
  is windowed across the instance: one entry per 15 minutes, carrying the count the previous window
  suppressed, through `countRateLimitTrip` with a fixed key. The caller chooses the address and the
  pathname prefix, so neither may key a window on this unlimited path.
- The match is the file's `pathname.endsWith`. Better Auth's router matches the path byte for byte
  and answers 404 for a trailing slash, an encoded byte, a changed case or a doubled slash, so the
  one spelling that runs the endpoint is the one refused.

## Spec impact

- Added: TOTP enrolment is required before the app is usable; TOTP cannot be disabled; recovery
  codes are issued at enrolment and complete a sign-in.
- Modified: none
- Removed: none
- Unchanged behaviour that must survive: enable, verify-totp, verify-backup-code and
  generate-backup-codes reach Better Auth and audit as before.

## Open questions

## Gate 1

approved
