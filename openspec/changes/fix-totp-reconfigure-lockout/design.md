# fix-totp-reconfigure-lockout — design

## Approach

A Better Auth plugin defined in the application, `lib/auth/totpReconfigure.ts`, registered after
`twoFactor` in `lib/auth/index.ts`. Its `before` hooks run inside Better Auth's own pipeline for
both the HTTP router (after its rate limiter) and `auth.api.*` (`dispatchAuthEndpoint` in
`better-auth/dist/api/dispatch.mjs`); a hook that returns a value answers the request and Better
Auth's handler never runs, and a hook that returns nothing lets the handler run.

Both hooks read the session with `getSessionFromCtx` (`better-auth/api`), the call Better Auth's
`sessionMiddleware` and `verifyTwoFactor` make; `ctx.context.session` is not set yet when a `before`
hook runs. Neither hook matches a path any `after` hook matches today, so a short-circuit skips
none.

- `POST /two-factor/enable`. The branch is decided from the user's `two_factors` row read through
  `ctx.context.adapter`, with Better Auth's own predicate for carrying `verified` over
  (`verified !== false`), never from `session.user.twoFactorEnabled`, which the cookie cache can
  hold for five minutes. No session, or no row passing that predicate: return nothing, and Better
  Auth's handler runs as today, so first-time enrolment is untouched. Otherwise the hook answers
  every outcome itself and never falls through, because falling through is the lockout: a body that
  fails its Zod schema throws `BAD_REQUEST`, and the password is checked with
  `ctx.context.password.checkPassword` (Better Auth's own check, its `INVALID_PASSWORD` error). It
  then generates a secret with `generateRandomString(32)`, encrypts it with `symmetricEncrypt` under
  `ctx.context.secretConfig`, replaces the user's pending entry in `verifications` (identifier
  `totp-reconfigure-<userId>`, expiring with the session that made it), and answers
  `{ totpURI, backupCodes: [] }`. The URI's issuer follows Better Auth's order
  (`body.issuer || options.issuer || appName`, the options read from
  `ctx.context.getPlugin("two-factor")`), the account is the user's email, and digits and period are
  the plugin's `totpOptions` or Better Auth's defaults (6, 30).
- `POST /two-factor/verify-totp`, with a session and an unexpired pending entry: validate the body
  (a failure throws `BAD_REQUEST`), decrypt the pending secret with `symmetricDecrypt` and verify
  the code against it. A wrong code throws Better Auth's `INVALID_CODE` as `UNAUTHORIZED`, the
  status Better Auth's `invalid` uses, and leaves the factor and the pending entry alone. A right
  code writes the pending ciphertext to the user's `two_factors.secret` through
  `ctx.context.adapter`, deletes the pending entry and answers what Better Auth's session
  verification answers (`{ token, user }`, the user through `parseUserOutput` from
  `better-auth/db`). No session (a sign-in challenge) or no unexpired pending entry: return nothing,
  and Better Auth verifies against the factor in force.
- `lib/auth/totp.ts`: pure helpers, `buildTotpUri` and `verifyTotpCode` (RFC 6238 over the secret's
  UTF-8 bytes, base32 in the URI, one step either side, `constantTimeEqual` from
  `better-auth/crypto`), unit-tested in `lib/auth/__tests__/totp.test.ts` with a frozen clock. The
  tests take their codes from `tests/e2e/support/totp.ts`, which stays a separate implementation so
  that it checks the helper rather than restating it.

The pending entry lives as long as the session that made it, not for a fixed time, because falling
through is safe only when no reconfigure is in flight. The dialog cannot outlive its session and
always starts with `enable`, so while it is open the entry exists until the swap. A fixed lifetime
would let a dialog left open past it fall through, where a code from the old authenticator (same
`Remit:<email>` label) verifies and the dialog reports a reconfiguration that never happened. After
the swap the entry is gone and falling through is what a retry needs: when `generate-backup-codes`
fails, `ScanStep` submits the code again, and Better Auth verifies it against the secret now in
force.

At every point the account has exactly one factor in force: the old one until the swap, which is a
single update of one row, and the new verified one after it. The recovery codes in force are the
user's saved set until `generate-backup-codes`, which the dialog calls after verification. If the
process stops between the swap and the deletion of the pending entry, the entry holds the secret
already in force, and a code for it swaps the same value again.

The setup wizard reaches its TOTP step only while `twoFactorEnabled` is false
(`features/setup/queries.ts`), so it calls `enable` against no row or an unverified one and reaches
Better Auth's handler. A second wizard tab submitted after the first finished enrolling reaches the
reconfigure branch, gets no codes, and shows its missing-codes error; the account keeps the factor
just verified.

## Rules

`.agents/rules/auth.md` forbids runtime writes to Better Auth tables and puts TOTP verification in
Better Auth's two-factor APIs. The exception is narrow and named there:
`lib/auth/totpReconfigure.ts` is the one runtime writer, inside Better Auth's pipeline and through
its adapters; it writes only `two_factors.secret` and its own `totp-reconfigure-<userId>` entry in
`verifications`, and it verifies a code only against that pending secret.
`.agents/rules/security.md` "Two-factor authentication" states that a reconfigured factor takes
effect only when a code from it verifies.

## Known limits

- First-time enrolment keeps a race that is Better Auth's: a wizard tab's `enable` that reads an
  unverified row while another tab's `verify-totp` marks it verified carries `verified: true` onto a
  new, unproven secret. It needs two requests of the same user within milliseconds, under the
  two-factor rate limit, and first-time enrolment is out of this change's scope.
- `app/api/auth/[...all]/route.ts` writes `auth.totp.reconfigured` on a successful `enable`, which
  now records a reconfiguration that has not happened yet, and on every successful `verify-totp`,
  sign-in included, without an actor there. The audit events are out of this change's scope.

Both are registered as gaps owned by `owner` when the change closes.

The dialog keeps its steps, copy and close behaviour; only its comment changes, to say where the
factor changes.

## Alternatives rejected

- Restore the previous row when the flow is abandoned (snapshot before `enable`, put it back on a
  timer or on the next request): Better Auth's handler carries `verified: true` onto the new row, so
  until the restore the unproven secret signs in and the user's own factor is refused. It needs a
  job to notice abandonment, and a crash between the handler's delete and the snapshot write loses
  the old row.
- Let Better Auth's `enable` run and move its row aside in an `after` hook: the same unproven row is
  in force between the handler's write and the hook, and a failure there leaves it in force.
- Call the library at a later step, generating the secret without persisting it: Better Auth has no
  endpoint that issues a TOTP URI without writing the factor, nor one that writes a given secret, so
  this collapses into the chosen approach.
- Intercept the paths in `app/api/auth/[...all]/route.ts`, as the disable refusal does: the route
  runs before Better Auth's rate limiter, so the password check in `enable` would be unlimited, and
  `auth.api.*` callers would bypass the fix.
- Verify the pending code with Better Auth's server-only `generateTOTP` endpoint: it returns only
  the current step's code, so a code typed just before a step boundary would be refused where Better
  Auth accepts it.
- A schema change for the pending secret (a column or a table): a migration for state that already
  fits Better Auth's `verifications` table, with its expiry.

## UI

n/a: the dialog's steps, copy and close behaviour stay as they are.

## Gate 2

n/a
