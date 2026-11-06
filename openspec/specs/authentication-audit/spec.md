# Authentication audit

An operator can read, in the insert-only audit log, how far each sign-in got and who changed the
recovery codes. The entries follow the stage reached, never the endpoint that answered, and callers
of `auth.api.*` are recorded the same as requests through the HTTP route.

## Status

verified

## Requirements

### Requirement: A sign-in is audited by the stage it reaches

The system SHALL write `auth.login.password_verified` when a sign-in's password checks out,
`auth.login.succeeded` only when a session is established, each carrying the user, and
`auth.login.failed` with the stage, `password` or `second_factor`, in its metadata when a stage
fails.

#### Scenario: No second factor applies

- WHEN a password sign-in establishes a session directly
- THEN `auth.login.password_verified` and `auth.login.succeeded` are written, both with the user

#### Scenario: A second factor is pending

- WHEN the password checks out and a second factor is still required
- THEN `auth.login.password_verified` is written with the user and `auth.login.succeeded` is not

#### Scenario: A second factor completes the sign-in

- WHEN a TOTP code or a recovery code completes a pending sign-in
- THEN `auth.login.succeeded` is written with the user

#### Scenario: The password is wrong

- WHEN a password sign-in fails
- THEN `auth.login.failed` is written with no user and the email and `stage: "password"` as metadata

#### Scenario: The second factor is wrong

- WHEN a TOTP code or a recovery code fails during a pending sign-in
- THEN `auth.login.failed` is written with the user and `stage: "second_factor"` as metadata

#### Scenario: A signed-in user verifies a code outside a sign-in

- WHEN a user holding a session verifies a code, as the reconfigure dialog and a first enrolment do
- THEN no login entry is written, whether the code is right or wrong

#### Scenario: Neither a session nor a challenge

- WHEN a second factor is submitted with neither a session nor a pending sign-in
- THEN nothing is written, so an anonymous caller adds no row per request

#### Scenario: The route records nothing of its own

- WHEN a sign-in answers through the HTTP route
- THEN the route writes no login entry; it writes only the rate-limit entry when a limit refuses

Enforced by: `lib/auth/__tests__/authAudit.integration.test.ts`
`app/api/auth/[...all]/__tests__/route.test.ts`

### Requirement: Regenerating recovery codes is audited

The system SHALL write `auth.backup_codes.regenerated`, carrying the user, when recovery codes are
replaced, and SHALL write nothing when the replacement is refused.

#### Scenario: The codes are replaced

- WHEN a signed-in user generates new recovery codes with the right password
- THEN one `auth.backup_codes.regenerated` entry is written with that user

#### Scenario: The password is wrong

- WHEN the same request carries a wrong password
- THEN nothing is written and the saved codes stay

Enforced by: `lib/auth/__tests__/authAudit.integration.test.ts`

## How it works

The `authAudit` plugin (`lib/auth/authAudit.ts`, registered in `lib/auth/index.ts`) hooks Better
Auth's pipeline, which runs for the HTTP route and for `auth.api.*` alike. An `after` hook on
`/sign-in/email` reads Better Auth's own answer: an error is a password failure, a two-factor
redirect is a pending second factor, and a new session is a completed sign-in. A `before` hook on
`/two-factor/verify-totp` and `/two-factor/verify-backup-code` finds the sign-in's pending user from
the challenge cookie and leaves it on the request, because Better Auth consumes the challenge while
it verifies; the `after` hooks on the same paths then write the session or the second-factor
failure. A request that holds a session has no challenge and is not a sign-in.
`lib/auth/auditContext.ts` builds the actor, address and user agent from the endpoint context.

`POST` in `app/api/auth/[...all]/route.ts` keeps `sign-in` in its audited set only for the
rate-limit entry, which is written before Better Auth runs. `auth.backup_code.consumed` is written
by the route (`openspec/specs/two-factor-authentication/spec.md`).

## Decisions

### D1: The entries are written inside Better Auth, not by the route

`auth.api.*` callers never pass through the route, and the route sees only a response status, which
cannot tell a pending second factor from a session. Rejected: reading the route's response body for
`twoFactorRedirect`, which leaves server-side callers unaudited; a database hook on session
creation, which also fires for the session Better Auth creates and deletes for a pending sign-in and
for the rotation a first enrolment performs.

### D2: A second-factor failure with no challenge writes nothing

The challenge is what names the user, so without one there is no actor and the request is anonymous.
`audit_logs` is insert-only, and the unauthenticated path sits in front of Better Auth's per-address
limit, which a forged `X-Forwarded-For` can dodge (GAP-4). Rejected: an entry without an actor,
which an anonymous caller could write once per request.

## Known limits

None.
