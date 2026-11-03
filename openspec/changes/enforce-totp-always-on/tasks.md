# enforce-totp-always-on — tasks

Each task is one commit whose body contains `Change: enforce-totp-always-on, task <n>`. Tick the box
in the same commit. A ticked box is a claim; `next-step` checks it against `git log`.

- [x] 1. Refuse the disable route, audited, with the rule and the spec requirement that state it
  - Do: in `app/api/auth/[...all]/route.ts`, answer `POST` paths ending in `/two-factor/disable`
    before `getAuditedRoute`, as the proposal's Decisions say; add `auth.totp.disable_refused` to
    `AuditEvent` in `lib/audit/index.ts`. In `app/api/auth/[...all]/__tests__/route.test.ts`, cover
    the refusal (status, body, handler never called) for a session of each role and for no session,
    the windowed audit entry, and that enable, verify-totp, verify-backup-code and
    generate-backup-codes still reach the handler. Add
    `app/api/auth/[...all]/__tests__/route.integration.test.ts` driving the real route and Better
    Auth: an enrolled user's disable request with the correct password is refused and the user stays
    enrolled. Replace the caveat in `.agents/rules/security.md`. Create
    `openspec/specs/two-factor-authentication/spec.md` (status `draft`) with the requirement that
    TOTP cannot be disabled.
  - Done when: the refusal tests pass, and fail with the refusal removed; `security.md` states the
    rule and its enforcing file with no caveat.
  - Verify:
    `pnpm exec vitest run "app/api/auth/[...all]/__tests__/route.test.ts" tests/docs/openspec.test.ts`
- [x] 2. Specify enrolment and recovery codes against the code
  - Do: add a test to `__tests__/proxy.test.ts` that a session with a business name and no TOTP
    factor is sent to `/setup` from a dashboard route, with no change to `proxy.ts`. Add the
    requirements "TOTP enrolment is required" and "Recovery codes" to the spec with `write-spec`,
    each verified in the code and anchored to a test that exists, plus How it works, Decisions and
    Known limits.
  - Done when: every requirement has scenarios and an anchor, and each scenario is one a named test
    asserts.
  - Verify: `pnpm exec vitest run __tests__/proxy.test.ts tests/docs/openspec.test.ts`
- [x] 3. Window the refusal's audit across the instance
  - Do: use a fixed trip key in `app/api/auth/[...all]/route.ts`, so a forged `X-Forwarded-For` can
    neither write a row per request nor grow the fallback counter; update the tests, the rule and
    the spec; correct the window comment.
  - Done when: the trip key holds no caller-chosen text.
  - Verify: `pnpm exec vitest run "app/api/auth/[...all]/__tests__/route.test.ts" tests/docs`
- [x] 4. Reset the instance window in the integration test
  - Do: in `app/api/auth/[...all]/__tests__/route.integration.test.ts`, clear the trip keys of
    `auth:two-factor-disable` before the request instead of sending a fresh address; word the spec
    scenario after what `route.test.ts` asserts, the fixed key.
  - Done when: the integration test passes twice within 15 minutes.
  - Verify:
    `pnpm exec vitest run --config vitest.integration.config.ts "app/api/auth/[...all]/__tests__/route.integration.test.ts"`
