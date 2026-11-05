# Two-factor authentication

A TOTP second factor protects every Remit account, for every role. An account holder cannot turn it
off, whatever the role and even with the correct password. Enrolment comes before the dashboard, and
recovery codes stand in for the authenticator at sign-in.

## Status

verified

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

- WHEN refusals repeat inside a window, counted under one fixed key that holds no address or path
- THEN one `auth.totp.disable_refused` entry is written, carrying the session user when there is one
  and the count the previous window suppressed, and the rest write nothing and read no session

#### Scenario: Other two-factor routes are untouched

- WHEN a caller posts to enable, verify-totp, verify-backup-code or generate-backup-codes
- THEN the route hands the request to Better Auth's HTTP handler, inside which the reconfigure
  plugin may answer enable and verify-totp

<!-- prettier-ignore -->
Enforced by: `app/api/auth/[...all]/__tests__/route.test.ts` `app/api/auth/[...all]/__tests__/route.integration.test.ts` `lib/auth/__tests__/totpReconfigure.integration.test.ts`

### Requirement: TOTP enrolment is required

The system SHALL send a session with no TOTP factor to `/setup` from a dashboard route, even when
the business profile is complete.

#### Scenario: A business name and no factor

- WHEN a session with a business name and no TOTP factor requests a dashboard route
- THEN the response redirects to `/setup`

#### Scenario: Setup stays reachable

- WHEN a session with no business name and no TOTP factor requests `/setup`
- THEN the request is not redirected

#### Scenario: An enrolled member

- WHEN a member with a business name and a TOTP factor requests the dashboard
- THEN the request is not redirected

#### Scenario: The wizard opens on the TOTP step

- WHEN the setup form starts on the TOTP step because the business profile is complete
- THEN it shows the TOTP step and no business profile field

Enforced by: `__tests__/proxy.test.ts` `features/setup/components/__tests__/SetupForm.test.tsx`

### Requirement: Recovery codes

The system SHALL show recovery codes once a TOTP factor is verified, and SHALL let a recovery code
stand in for a TOTP code at sign-in.

#### Scenario: Enrolling during setup

- WHEN a code from the authenticator verifies in the setup wizard
- THEN the codes `twoFactor.enable` returned are listed, and confirming them and continuing finishes
  the wizard

#### Scenario: Reconfiguring in security settings

- WHEN a code from the new authenticator verifies in the reconfigure dialog
- THEN the recovery codes saved before stay valid until `twoFactor.generateBackupCodes` replaces
  them, the codes it returned are listed, and confirming them closes the flow with a success message

#### Scenario: Choosing a recovery code at sign-in

- WHEN the user selects the recovery option on the TOTP form
- THEN the form asks for a recovery code

#### Scenario: A code is accepted

- WHEN a recovery code is accepted on the recovery form
- THEN the form hands on to the signed-in state

#### Scenario: A code is refused

- WHEN verification of a recovery code fails
- THEN the form shows the error verification returned

#### Scenario: A malformed code

- WHEN the entered text does not match the recovery code format
- THEN the form shows a format error

#### Scenario: A verified code is audited

- WHEN a recovery code verifies on a request that carries a session
- THEN an `auth.backup_code.consumed` entry is written with that user as actor and target

<!-- prettier-ignore -->
Enforced by: `features/setup/components/__tests__/SetupForm.test.tsx` `features/settings/security/components/TotpReconfigureDialog/__tests__/TotpReconfigureDialog.test.tsx` `features/auth/components/LoginForm/__tests__/TotpForm.test.tsx` `features/auth/components/LoginForm/__tests__/RecoveryCodeForm.test.tsx` `app/api/auth/[...all]/__tests__/route.test.ts` `lib/auth/__tests__/totpReconfigure.integration.test.ts`

### Requirement: Reconfiguring keeps the current factor until the new one verifies

The system SHALL keep the current authenticator and recovery codes of a user with a verified factor
working when that user starts a reconfiguration, and the new secret MUST NOT sign in until a code
from it has verified in a session of that user.

#### Scenario: A reconfiguration stops after the first step

- WHEN a user with a verified factor starts a reconfiguration and stops before any code verifies
- THEN the current authenticator and a saved recovery code still sign in, and a code from the new
  secret does not

#### Scenario: A code from the new secret verifies

- WHEN a code from the new secret verifies
- THEN sign-in accepts the new authenticator and refuses the previous one

#### Scenario: The same code is submitted again after the swap

- WHEN the code that completed the swap is submitted again
- THEN it verifies, which is the retry the dialog makes when recovery code generation fails

#### Scenario: A wrong code

- WHEN a wrong code is submitted while the new secret is pending
- THEN the response is `401`, the current factor stays in force, and a later code from the new
  secret still verifies

#### Scenario: A wrong password or an invalid body

- WHEN a user with a verified factor posts to enable with a wrong password or a body that fails
  validation
- THEN the request is refused and the current factor stays in force

#### Scenario: First-time enrolment

- WHEN a session with no verified factor posts to enable
- THEN Better Auth's handler runs and returns the recovery codes, as in the setup wizard

#### Scenario: A pending secret outlives the factor

- WHEN a pending secret exists for a user whose factor row is gone and that user enrols again
- THEN a code from the new secret verifies and signs in, because a pending secret is consulted only
  while the user has a verified factor

<!-- prettier-ignore -->
Enforced by: `lib/auth/__tests__/totpReconfigure.integration.test.ts` `lib/auth/__tests__/totp.test.ts`

## How it works

`POST` in `app/api/auth/[...all]/route.ts` matches the path suffix `/two-factor/disable` before it
reads the body, and answers from `refuseTwoFactorDisable`. That function counts the refusal with
`countRateLimitTrip` (`lib/rateLimit/tripCounter.ts`) and writes the audit entry only when the count
says so. A session read that fails is logged and the entry is written without an actor; the response
stays `403`.

Better Auth's router matches a path byte for byte and answers `404` for a trailing slash, an encoded
byte, a changed case or a doubled slash, so the one spelling that runs the endpoint is the one
refused.

`proxy.ts` counts setup as complete only with a business name on the settings row and a TOTP factor
on the session; until then it sends every route but `/setup` and `/api/setup/` to `/setup`.
`app/(auth)/setup/page.tsx` picks the wizard's first step from `getSetupProgress`
(`features/setup/queries.ts`).

The setup wizard takes its codes from `twoFactor.enable`
(`features/setup/components/TotpEnableStep.tsx`) and lists them in `RecoveryCodesStep.tsx`. The
reconfigure dialog requests its own after the new factor verifies
(`features/settings/security/components/TotpReconfigureDialog/ScanStep.tsx`).
`features/auth/components/LoginForm/TotpForm.tsx` opens `RecoveryCodeForm.tsx`, and `POST` in
`app/api/auth/[...all]/route.ts` audits a successful verification.

The `totpReconfigure` plugin (`lib/auth/totpReconfigure.ts`, registered after `twoFactor` in
`lib/auth/index.ts`) has two `before` hooks, so both the HTTP router and `auth.api.*` reach them.
For a user whose `two_factors` row exists and is not unverified, `enable` checks the body and the
password itself, never hands the request to Better Auth's handler, and answers a TOTP URI with no
recovery codes after storing the new secret, encrypted with Better Auth's `symmetricEncrypt`, as the
`totp-reconfigure-<userId>` entry in `verifications`. The entry is keyed to the user, not to a
session: it lapses at the expiry the session that created it had, signing out does not remove it,
and a later `enable` replaces it. A `verify-totp` from any session of a user with a verified factor
and an unexpired entry checks the code against the pending secret with `verifyTotpCode`
(`lib/auth/totp.ts`); a wrong code answers `401` and changes nothing, a right one writes the pending
ciphertext to `two_factors.secret`, deletes the entry and answers as Better Auth does. Without a
session or an entry the request goes on to Better Auth, so first-time enrolment, sign-in and a retry
after the swap run its own handlers.

## Decisions

### D1: The refusal is `403` with the forbidden message, the same for every caller

The route never asks who is calling before it refuses, so no session changes the answer. Rejected:
`404`, because the route is known and refused; `401`, because signing in would not change the
answer.

### D2: The refusal's audit is windowed across the instance

One entry per 15 minutes, carrying the count the previous window suppressed. The route is reachable
without a session and sits before Better Auth's limiter, so the session is read only when an entry
is written and a flood costs one Redis round trip per request. The trip key is a fixed string,
because the caller chooses both the pathname prefix and, without a proxy that overwrites it,
`X-Forwarded-For`. A flood can therefore hide the actor of another attempt, which is still refused
and counted. Rejected: a row per request, or a window per address or pathname, because an anonymous
caller could flood the insert-only `audit_logs` and grow the in-memory fallback counter.

### D3: Enrolment is enforced by the routing guard, from the database and the session

`proxy.ts` derives "setup complete" on every request from the settings row and the session, so a
user cannot leave the wizard by navigating away. Rejected: a routing cookie, which
`.agents/rules/security.md` forbids.

### D4: A reconfigured secret is held, then swapped in one update, by a Better Auth plugin

Better Auth's `enable` deletes the verified user's row and inserts an unproven secret with
`verified: true` carried over, which refuses the user's own authenticator and recovery codes from
the first dialog step. A plugin's `before` hooks run inside Better Auth's pipeline, after its rate
limiter and for `auth.api.*` callers too, and the account has exactly one factor in force at every
point: the old one until a single row update, the new verified one after. The pending entry is keyed
to the user and lapses at the expiry the session that created it had, not after a fixed time: a
fixed lifetime could lapse while the dialog is open, and a code from the old authenticator would
then verify through Better Auth while the dialog reports a reconfiguration that never happened. Any
session of the user that submits a code from the pending secret completes the swap; signing out does
not remove the entry, and a later `enable` replaces it. Once a verified row is found the `enable`
hook answers every outcome, because handing a request on is the lockout. Rejected: restoring the old
row when the flow is abandoned, because the unproven secret signs in until then and a crash loses
the old row; moving the row aside in an `after` hook, which leaves the unproven row in force in
between; intercepting in the route, which runs before the rate limiter and is bypassed by
`auth.api.*`; a column or table for the pending secret, a migration for state `verifications`
already holds.

## Known limits

- GAP-5: The route writes `auth.totp.reconfigured` on every successful `enable` and `verify-totp`,
  so a reconfiguring user's entry predates the change of factor, and a sign-in verification writes
  one with no actor.
- GAP-6: First-time enrolment keeps Better Auth's two-tab race on `enable`, which can carry
  `verified: true` onto an unproven secret.
- GAP-7: A transient session-read failure on `enable` for a verified user reaches Better Auth's
  handler, because the hold cannot tell it from a missing session.
