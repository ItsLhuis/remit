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
- [x] 2. Hold a reconfigured TOTP secret until it verifies
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
- [x] 3. Make the spec say exactly what binds the pending secret
  - Do: in `openspec/specs/two-factor-authentication/spec.md`, word the requirement "Reconfiguring
    keeps the current factor until the new one verifies", "How it works" and D4 after what the code
    does: the pending entry is keyed to the user (`totp-reconfigure-<userId>`), any session of that
    user that submits a code from the pending secret completes the swap, and the entry lapses at the
    expiry the session that created it had (signing out does not remove it; a later `enable`
    replaces it); add `lib/auth/__tests__/totpReconfigure.integration.test.ts` to the `Enforced by:`
    line of "TOTP cannot be disabled" (its scenario "Other two-factor routes are untouched" is
    proven for the plugin half only there); in the integration test, rename "refuses the code when
    the factor row is gone before the swap" to what it exercises (the code is refused by Better Auth
    when the factor row is gone before the code is submitted).
  - Done when: no sentence of the spec claims a binding to the session id or to the creating session
    beyond the expiry; the anchor line lists the plugin's test; the test title names what the test
    asserts.
  - Verify: `pnpm exec vitest run tests/docs`
