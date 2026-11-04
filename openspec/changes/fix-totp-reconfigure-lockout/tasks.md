# fix-totp-reconfigure-lockout — tasks

Each task is one commit whose body contains `Change: fix-totp-reconfigure-lockout, task <n>`. Tick
the box in the same commit. A ticked box is a claim; `next-step` checks it against `git log`.

- [x] 1. Add the TOTP helpers the reconfigure hold needs
  - Do: create `lib/auth/totp.ts` with two pure functions and no IO: `buildTotpUri` (the
    `otpauth://totp/<issuer>:<account>?secret=<base32>&issuer=&digits=&period=` URI Better Auth's
    `createOTP(...).url` builds, base32 of the secret's UTF-8 bytes without padding) and
    `verifyTotpCode` (RFC 6238 HMAC-SHA-1 over the secret's UTF-8 bytes, the given digits and
    period, one step either side, `constantTimeEqual` from `better-auth/crypto`, the time passed
    in). Unit-test them in `lib/auth/__tests__/totp.test.ts` with a frozen clock: a URI whose secret
    `tests/e2e/support/totp.ts`'s `generateTotpCode` turns into a code `verifyTotpCode` accepts; the
    previous and next step accepted; two steps away, a wrong code and a code of the wrong length
    refused; the issuer and account encoded in the label.
  - Done when: both helpers exist and their tests pass; nothing imports them yet.
  - Verify: `pnpm exec vitest run lib/auth/__tests__/totp.test.ts`
- [ ] 2. Hold a reconfigured TOTP secret until it verifies
  - Do: create `lib/auth/totpReconfigure.ts`, a Better Auth plugin with the two `before` hooks
    `design.md` describes (`enable` for a session whose user has a verified factor; a session's
    `verify-totp` with a live pending entry), using `getSessionFromCtx`, `APIError` and
    `TWO_FACTOR_ERROR_CODES` from Better Auth's public exports, `generateRandomString`,
    `symmetricEncrypt` and `symmetricDecrypt` from `better-auth/crypto`, Zod for both bodies, and
    the helpers from task 1; register it after `twoFactor` in `lib/auth/index.ts`. Commit
    `lib/auth/__tests__/totpReconfigure.integration.test.ts` with its reproduction test, plus tests
    that: completing the flow switches sign-in to the new authenticator and refuses the old one;
    submitting the same code again after the swap still verifies (the retry `ScanStep` makes when
    `generate-backup-codes` fails); the saved recovery codes keep working until
    `generate-backup-codes` replaces them; a wrong code leaves the old factor in force and the
    pending secret still usable; a wrong password or an `enable` body that fails validation, for a
    verified factor, is refused and leaves the old factor in force. Follow `design.md` "Approach"
    and "Rules" exactly: the pending entry expires with the session, and once a verified row is
    found the `enable` hook never falls through. Update the comment in `TotpReconfigureDialog.tsx`
    to say where the factor changes. In `.agents/rules/security.md` "Two-factor authentication",
    state that a reconfigured factor takes effect only when a code from it verifies, naming the
    plugin; in `.agents/rules/auth.md`, add the narrow exception `design.md` "Rules" words. In the
    spec, add the requirement "Reconfiguring keeps the current factor until the new one verifies"
    with scenarios and an `Enforced by:` line naming the integration and unit tests, correct the
    reconfigure scenario of "Recovery codes", word "Other two-factor routes are untouched" at the
    route layer, and update How it works and Decisions.
  - Done when: the reproduction test passes, as do the new ones; the setup wizard's, sign-in's and
    the route's tests still pass unchanged; the rules, the dialog comment and the spec say what the
    code does.
  - Verify:
    `pnpm exec vitest run --config vitest.integration.config.ts lib/auth/__tests__/totpReconfigure.integration.test.ts "app/api/auth/[...all]/__tests__/route.integration.test.ts" lib/auth/__tests__/passwordReset.integration.test.ts`
    and
    `pnpm exec vitest run lib/auth/__tests__/totp.test.ts features/settings/security features/setup "app/api/auth/[...all]/__tests__/route.test.ts" tests/docs`
