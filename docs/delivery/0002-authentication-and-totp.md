# DR-0002: Authentication, onboarding and mandatory TOTP

- **Status:** Shipped
- **Date:** 2026-05-13
- **Verdict:** Complete
- **Decisions:** ADR-0003, ADR-0012, ADR-0013
- **Supersedes:** —
- **Reconstructed:** yes

## What

Registration, login, the onboarding wizard that bootstraps an instance, mandatory TOTP with recovery
codes, and both password reset paths.

## Why

Remit holds a freelancer's client list, contracts and bank details on a server they operate
themselves, frequently exposed to the internet. A password alone is not a credible boundary around
that, and an optional second factor is one nobody turns on. The instance also has to bring itself up
from nothing: a fresh database has no user, no organization and no business profile, and the first
visitor has to become the owner without any of that existing yet.

## Scope

Included: email and password credentials, the login flow with its TOTP step, registration, the setup
wizard covering account, business profile, TOTP enrolment and recovery codes, session and role
helpers, the routing state machine that decides where an incomplete instance sends a visitor, forced
password rotation after an operational reset, password reset by email when email is configured, and
the `remit:reset-password` recovery CLI for when it is not.

Excluded: any TOTP opt-out, per ADR-0003 — no setting, no environment variable and no role bypasses
it. Also excluded is Remit owning any authentication state of its own: users, sessions, credentials,
TOTP secrets, backup codes, organizations and memberships are Better Auth's, per ADR-0013, and
runtime code reaches them through Better Auth APIs rather than through Drizzle.

## How

The routing state machine in `proxy.ts` derives where a visitor goes entirely from the database and
the session, never from a cookie. ADR-0001 records why: routing state in a cookie is client-supplied
and can be forged, and the onboarding gate is exactly the thing an attacker would want to skip.

The two password reset paths in ADR-0012 exist because the self-hosted case has a failure mode SaaS
does not — an operator who has lost their password on an instance where email was never configured
has no way back in through the product at all. The CLI is the answer, and it is one of the few
places permitted to write a Better Auth-owned table directly; it sets `users.mustChangePassword` so
the temporary credential cannot survive the next login.

`requireSession` and `requireRole` in `lib/auth/session.ts` are the only application authorization
helpers. `requireRole` reads the active member role from Better Auth and deliberately does not
create or repair a membership when one is missing: a self-healing authorization helper cannot fail
closed.

## Evidence

- `lib/auth/index.ts`, `lib/auth/client.ts`, `lib/auth/session.ts`
- `proxy.ts` — the routing state machine and its security headers
- `features/auth/`, `features/setup/`
- `app/(auth)/login`, `app/(auth)/register`, `app/(auth)/setup`, `app/(auth)/reset-password`,
  `app/(auth)/change-password`, `app/api/auth/[...all]/route.ts`
- `scripts/reset-password.ts`, `docs/architecture/operations/CLI-CONTRACT.md` — the
  `pnpm remit:reset-password` section
- `docs/architecture/adr/0003-mandatory-totp.md`,
  `docs/architecture/adr/0012-password-reset-paths.md`

## Verification

Integration tests cover the setup mutations and the auth routes; component tests cover the login,
TOTP, register, reset and change-password forms. `tests/e2e/auth.spec.ts` walks register → setup →
TOTP enrolment against a real instance, and `tests/e2e/ownerProvision.setup.ts` provisions the owner
session the rest of the E2E suite depends on.

Not covered: the E2E walk stops at the TOTP QR step rather than completing enrolment with a
generated code, so the recovery-code path is exercised by unit and integration tests only. Password
reset by email is verified against the transactional email service rather than against a real
mailbox.

## Known gaps

The canonical end-to-end flow for password reset via a recovery code has no Playwright spec.
