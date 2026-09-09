# DR-0041 — Canonical end-to-end flow coverage

- **Status:** Shipped
- **Date:** 2026-09-09
- **Verdict:** Complete with known gaps
- **Decisions:** ADR-0002, ADR-0003, ADR-0012, ADR-0023
- **Supersedes:** —

## What

The three canonical cross-feature flows that had no test — proposal acceptance to payment, recurring
generation, and password reset — now have one, and the two that were already covered were audited
rather than assumed.

## Why

`.agents/rules/testing.md` and `docs/architecture/ARCHITECTURE.md` section 17 both name five
canonical end-to-end flows as the coverage this product is held to. They are the only place several
feature modules are ever exercised together, and three of the five had nothing behind them: a
commitment stated in two documents and met by neither. The money path from an accepted proposal to a
recorded payment — the longest chain in the product — was among them.

## Scope

Included: flow 2 (client → project → proposal → anonymous OTP acceptance → invoice → payment), flow
4 (a due schedule swept through a real worker), flow 5 (password reset with the second factor still
demanded), an audit of flow 1, and the support helpers the three share.

Excluded, with reasons:

- **No application code changed.** Every place a flow could not be driven without changing the
  product is recorded under Known gaps instead.
- **Flow 3 was not touched.** It shipped with the time-and-expense conversion that built it.
- **Flow 1 was audited, not extended.** Its recovery-code screen is reachable — the manual-entry
  secret is rendered as text, so a browser can complete enrolment without reading the QR — but the
  step only runs on an instance with no owner, which no developer machine with a finished setup can
  produce. Writing a spec that cannot be seen to pass is worse than naming the gap.
- **Flow 5 is not a Playwright spec.** Remit has exactly one user by construction (ADR-0002), so a
  browser-driven reset changes the credential every other spec authenticates as, and on a
  self-hosted instance that is a real account with no way to put it back.

## How

Flow 2 drives the whole chain through the UI, and takes the acceptance half in a separate browser
context — accepting while signed in as the owner would exercise none of the token or OTP path a
client walks. Its one-time code is read out of the development mail sink rather than the database,
because `proposal_otps.code_hash` is a bcrypt hash and `email_logs` records the subject and never
the body: there is no way to observe that code from inside without weakening the application, and
the catcher observes exactly what the recipient would have received. Its two line items are shaped
so neither feature touches the other's arithmetic — one taxed and undiscounted, one discounted and
untaxed — so no rounding order can move the total the spec asserts.

Flow 4 spawns the production worker entrypoint as a child process and enqueues through the real
`enqueueJob`. Stage 28's lesson is the reason: a stubbed queue accepts every job id ever written,
and two ids BullMQ refuses sat undetected for six stages. The occurrence is made due by dating the
schedule in the past rather than by faking a clock, because BullMQ's own lock and delay arithmetic
reads the same clock. The re-delivery step carries a fresh job id and the occurrence key the sweep
already generated, which is what a genuine re-delivery looks like once BullMQ has freed the original
— so the guard under test is the transaction's re-read of `next_run_at`, not the deterministic id.

Flow 5 stubs only the mail transport, which is what makes Better Auth's reset link observable: the
token is stored hashed, so nothing in the database can hand it back. The link points at
`/api/auth/reset-password/<token>`, whose last path segment is the same value the reset page reads
from its search params after Better Auth's redirect.

Three helpers are shared rather than copied: the mail-sink client, the SMTP arrangement, and the
worker harness. The SMTP arrangement refuses to run on an instance that already has a provider
configured and answers `false` instead, because the only way to restore such an instance afterwards
would be to snapshot a real SMTP password to disk.

## Evidence

- `tests/e2e/proposalToPaid.spec.ts`, `tests/e2e/recurringGeneration.spec.ts` — flows 2 and 4.
- `lib/auth/__tests__/passwordReset.integration.test.ts` — flow 5.
- `tests/e2e/support/mailbox.ts`, `emailDelivery.ts`, `jobWorker.ts`, `recurringScheduleFixture.ts`,
  `taxRateFixture.ts` — the shared arrangement.
- `playwright.config.ts` — the `flows-email` and `flows-jobs` projects and why each is serialised.
- `.agents/rules/testing.md` Tier 3 and `docs/architecture/ARCHITECTURE.md` section 17 — updated to
  name where each of the five flows is covered, including the one that is not a Playwright spec.

## Verification

`pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm test` and `pnpm test:integration` all
pass. `pnpm test:e2e` was run to completion six times consecutively — 135s, 128s, 127s, 126s, 124s
and 125s against a 109s baseline — with the last three on the final code. Each new spec was seen
named in the run output, and each was seen to fail when the behaviour it asserts was broken and pass
again when it was restored.

Not covered: flow 4 skips itself where the test process cannot reach Redis, which is the case in the
E2E workflow as configured, so that flow's user-visible half runs on a developer host and not yet in
CI. Its queue mechanism is covered on every pull request by
`lib/jobs/__tests__/queueRoundTrip.integration.test.ts`, which runs a real queue and a real worker.
Flow 2 skips itself on an instance that already has an email provider configured.

## Known gaps

- Flow 1's recovery-code screen is asserted nowhere. `tests/e2e/support/ownerProvisioning.ts`
  finishes enrolment through Better Auth's endpoints and never renders it, and `auth.spec.ts` stops
  at the QR step. Its comment gives the reason as a QR image a browser cannot read; that reason is
  stale, because `features/setup/components/TotpVerifyStep.tsx` renders the manual-entry secret as
  text beside it.
- The e2e workflow gives the Playwright process a compose-internal `REDIS_URL`, so flow 4 cannot
  reach the queue there and skips. Publishing Redis to the runner the way `docker-compose.ci.yml`
  already publishes Postgres would close it.
- The mail sink is a development-only service and is absent from the CI compose stack, so flow 2's
  OTP is unobservable there.
- `features/proposals/mutations.ts` reports an unexpected failure on the create path with
  `proposals.errors.updateFailed` — a user creating a proposal is told the update failed.
- `PublicProposalIdentityForm` validates on blur and gates its submit on validity, so a client who
  types an address and clicks straight through finds the button disabled.
- `RecurringInvoiceSummaryCard` pairs each label and value as two siblings with no accessible
  association, so neither a test nor a screen reader can address a value by its label.
- `tests/e2e/timeToInvoice.spec.ts` fails intermittently: its assertions carry the default
  five-second budget while `next dev` compiles a route inside the test body. The new specs bound
  that wait on the condition instead.
