# fix-totp-reconfigure-lockout

## Product position

The reconfigure dialog in security settings
(`features/settings/security/components/TotpReconfigureDialog/`) starts with
`authClient.twoFactor.enable`. For a user whose factor is already verified, Better Auth's enable
handler (`better-auth/dist/plugins/two-factor/index.mjs`) deletes the `two_factors` row and inserts
one with a new secret and new recovery codes, carrying `verified: true` over. From that first step
on, the authenticator the user holds and every recovery code they saved are refused at sign-in,
while the new secret, never proven, is accepted. A closed tab, a crash or a lost connection before
the scan step leaves the account with no factor its holder can produce once the session ends.
`lib/auth/__tests__/totpReconfigure.integration.test.ts` reproduces it: after `enable` alone, the
old code and an old recovery code are refused and a code from the new secret signs in.

The fix keeps the verified factor in force until a code from the new secret verifies.

## Scope

- In: a Better Auth plugin in the application (`lib/auth/`) that, for a user with a verified factor,
  answers `enable` by holding the new secret as pending, and answers a session's `verify-totp` by
  verifying the code against that pending secret and only then writing it to the factor; the TOTP
  helpers it needs; tests; the dialog comment; `.agents/rules/security.md` and
  `.agents/rules/auth.md`; the capability spec.
- Out: forking or patching Better Auth; the dialog's steps, copy and close behaviour; first-time
  enrolment in the setup wizard; sign-in; recovery-code redemption; `generate-backup-codes`; the
  disable refusal; the audit events and where `app/api/auth/[...all]/route.ts` writes them;
  `package.json` (no new dependency).

## Capabilities touched

- `two-factor-authentication` (`openspec/specs/two-factor-authentication/spec.md`)

## Decisions

- The pending secret is generated and encrypted with Better Auth's own `generateRandomString` and
  `symmetricEncrypt` (`better-auth/crypto`) under the instance's secret configuration, so the value
  written to the factor on verification is the one Better Auth's handlers decrypt. It is held in
  Better Auth's `verifications` table through `internalAdapter`, one entry per user, expiring with
  the session that made it.
- Verification of a code against the pending secret is an in-application RFC 6238 check with the
  same parameters as Better Auth's (SHA-1, six digits, thirty seconds, one step either side,
  constant-time comparison). Better Auth does not export its OTP helper and `@better-auth/utils` is
  not a dependency of the application.
- Recovery codes are untouched by the hold and the swap: the codes the user holds keep working until
  `generate-backup-codes` replaces them, which the dialog calls right after verification. The
  reconfigure answer to `enable` therefore carries no recovery codes.
- No new audit event: `enable` and `verify-totp` keep answering `200` on success, so the route
  writes `auth.totp.reconfigured` exactly where it does now.
- Options considered and their trade-offs are in `design.md`.

## Spec impact

- Added: "Reconfiguring keeps the current factor until the new one verifies".
- Modified: "Recovery codes" — the reconfigure scenario states that the recovery codes in force stay
  valid until the dialog replaces them after the new factor verifies. "TOTP cannot be disabled",
  scenario "Other two-factor routes are untouched" — it states the route layer: the route hands
  enable and verify-totp to Better Auth's HTTP handler, inside which the reconfigure plugin may
  answer.
- Removed: none
- Unchanged behaviour that must survive: first-time enrolment in the setup wizard (`enable` for a
  user with no verified factor reaches Better Auth's handler and its codes are listed); sign-in with
  a TOTP or a recovery code; `generate-backup-codes`; the disable refusal and its audit; the
  `auth.totp.reconfigured` and `auth.backup_code.consumed` entries; the dialog's steps and copy.

## Open questions

## Gate 1

approved
