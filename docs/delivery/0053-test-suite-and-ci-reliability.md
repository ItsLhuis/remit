# Test suite and CI reliability

- **Status:** Shipped
- **Date:** 2026-09-23
- **Verdict:** Complete
- **Decisions:** —
- **Supersedes:** —

## What

The gates that decide whether Remit is broken now fail only when something is broken: line endings,
test isolation, suite determinism, the end-to-end suite's own environment, and two checks that did
not exist.

## Why

Several gates failed when nothing was wrong. A fresh Windows clone failed `pnpm format:check` on
every text file before anyone had edited anything, and the documentation tests failed with it. The
unit suite timed out on the same handful of files run after run, and delivery record after delivery
record recorded that condition as "times out under full-suite load, as before". The integration
suite counted, queued and obliterated against whatever Redis answered on the development port, which
on a developer host is the development stack's own queue. The recurring-generation flow skipped
itself in CI because the Playwright process could not reach the queue. A gate that fails at random
teaches every later change that red can be ignored.

Two checks were missing rather than unreliable: nothing caught a change that reaches a running
instance without a changelog entry, and a developer whose database was behind on migrations saw
empty screens rather than a reason.

## Scope

Included: `.gitattributes` and the formatter's treatment of generated files; the documentation
tests' tolerance of line endings; the unit suite's worker pool, the tests that timed out under it,
and the one that raced; the integration suite's own Redis and Compose project; the end-to-end
suite's bounded waits and its worker ceiling; Redis published to the runner for the end-to-end
workflow; a changelog gate on pull requests; a migration-drift warning at development boot.

Excluded: the services coverage threshold and the tests missing under it, which is its own
capability and not reachable while the suite it would gate still times out. No product behaviour was
changed; the one addition to the running application is a log line a development server prints at
boot.

## How

Every fix started from a measurement of the unmodified suite, and each failure was traced to one of
four causes before anything changed.

**The checkout.** `.gitattributes` stores and checks out every text file with LF whatever
`core.autocrlf` says, with explicit binary patterns. It cannot rewrite a working tree that was
checked out before it existed, so `tests/docs/delivery.test.ts` also normalises line endings before
it searches for a section heading. The drizzle-kit snapshots are excluded from Prettier: they are
regenerated on every `pnpm database:generate` and never hand-edited, so a formatting complaint about
one could only be answered by editing a generated file.

**Work a test did that it should not.** Two form tests typed every character of their setup values,
and each keystroke re-validated and re-rendered the whole form; they paste instead, since neither
asserts per-keystroke behaviour. The sanitisation test walked and read the source tree once per test
and now does it once per file. The destination test re-imported the AWS SDK graph in every case
through `vi.doMock` and `vi.resetModules()`, and now mocks the client once at module load.

**The pool.** Vitest's default of all cores but one oversubscribed a twelve-core host: each worker
runs happy-dom, React and user-event. `vitest.config.ts` caps it at half the cores, which on that
host was both faster and within budget. The installer tests are the one place a raised timeout
stays: every case runs the real `install.sh` through `bash`, up to three times, and that cost is
process creation rather than anything the file could do more cheaply.

**Setup inside a timed hook.** The queue round-trip, scheduled-backup and job-catalog integration
files imported every feature's job module — most of the application's module graph — inside
`beforeAll`, and under load that transform outlasted the ten-second hook budget; the catalog had
been given a hand-raised thirty. All three now load the modules while the file is collected, which
costs the same and sits under no fixed budget, and the raised timeout is gone.

**A race.** The API token dialog's test asserted that the revealed token was gone in the same tick
as the click that removes it; the removal goes through Radix's open-change callback and can land a
render later under load. The assertion now waits for the outcome.

The integration suite has a Compose project of its own, so `docker compose down -v` on it can no
longer reach the development stack's containers, and its own Redis on 6380, which the configuration
now points at. Before, the suite's queue test obliterated whatever answered on 6379.

The end-to-end suite runs against a production build locally as it already did in CI. Its starvation
"above two workers" was `next dev` compiling routes inside tests: under it the flows failed at every
worker count down to two, while against a build the whole suite was green at six and at twelve. With
that measured, the worker count is pinned at half the cores. The spec for flow 3 bounds its waits on
the page's own condition and retries its first interaction after each full page load until its
outcome appears, the pattern the proposal flow already used; the two now share those helpers. The
E2E workflow publishes Redis to the runner and hands only the Playwright step a runner-side address,
so flow 4 runs in CI instead of skipping, while the app and worker containers keep the
compose-internal one.

The changelog gate reads the Unreleased section through the parser the release command already used,
so "the changelog records something" means one thing in both. A pull request that touches
application code, the database, the images, the proxy configuration or an operator script must add
an entry that the base branch did not have; tests, tooling and documentation are exempt, and the
`no-changelog` label is the escape hatch for a change that reaches no instance.

The migration warning reuses the query behind the migrations row on `/settings/system`, so there is
one definition of "behind". It runs from `instrumentation.ts` in development only — a container
migrates on start, so only a developer can be behind — and is not awaited, so a database that is
down still leaves `pnpm dev` starting.

## Evidence

- `.gitattributes`, `.prettierignore`
- `tests/docs/delivery.test.ts`, `tests/docs/sanitization.test.ts`
- `vitest.config.ts` (worker pool), `vitest.integration.config.ts` (Redis)
- `scripts/host/__tests__/install.test.ts` (measured timeout)
- `scripts/core/destination/__tests__/destination.test.ts`
- `features/proposals/components/ProposalForm/__tests__/ProposalForm.test.tsx`,
  `features/auth/components/__tests__/RegisterForm.test.tsx`
- `features/settings/api/components/ApiSettingsPage/__tests__/CreateApiTokenDialog.test.tsx`
- `lib/jobs/__tests__/queueRoundTrip.integration.test.ts`,
  `lib/jobs/__tests__/jobCatalog.integration.test.ts`,
  `features/backups/__tests__/scheduledBackup.integration.test.ts`
- `docker-compose.test.yml` (project name, Redis port), `docker-compose.ci.yml` (Redis published)
- `playwright.config.ts` (production web server, worker ceiling, timeout reason)
- `tests/e2e/support/pageReadiness.ts`, `tests/e2e/timeToInvoice.spec.ts`,
  `tests/e2e/proposalToPaid.spec.ts`
- `.github/workflows/e2e.yml` (runner-side `REDIS_URL` for the Playwright step)
- `.github/workflows/ci.yml` (`changelog` job), `scripts/check-changelog.ts`,
  `scripts/core/release/changelogGate.ts`, `scripts/core/release/changelog.ts`'s
  `unreleasedEntries`, `scripts/core/release/__tests__/changelogGate.test.ts`
- `features/health/queries.ts`'s `getMigrationDrift`, `features/health/startupChecks.ts`,
  `features/health/__tests__/startupChecks.test.ts`, `instrumentation.ts`

## Verification

Everything was measured first, on a twelve-core Windows host with the development stack running.
Before any change, every one of nine full unit runs — five plain, four with coverage — failed: the
proposal form's row-removal case in all nine, the installer's fresh-secrets case in six, the API
token dialog's race in four, and three other installer and registration cases now and then. A fresh
`core.autocrlf=true` clone failed `pnpm format:check` on 2,156 files and two of the delivery tests.
Three integration runs passed, but between them the development stack's own Redis received 617
connections and 6,089 commands from the suite and kept 21 of its keys; and with the unit suite
saturating the host alongside, the queue round-trip and scheduled-backup files timed out in their
`beforeAll` two runs out of two. Flow 4 skipped itself whenever the Playwright process was handed
the compose-internal Redis address.

After the change:

- `pnpm test` five times in a row: 2,512 tests, no failure and no timeout, 106–120s; the slowest
  single test across the five was 2.7s against the five-second budget.
- `pnpm test:coverage` twice: 2,512 tests, no failure and no timeout. Both runs exit 1 on the
  services branch threshold (86.37% against 90%), which is the coverage capability excluded above.
- `pnpm test:integration` three times on the final code with the development stack up: 882 tests, no
  failure, 732–746s. A `MONITOR` on the development Redis across all three saw nothing but its own
  container's health-check `ping`s; the suite's Redis on 6380 served 2,258 connections and 23,772
  commands. The three worker-backed files and the job catalog passed three runs out of three under
  the same saturating load that had timed them out.
- A fresh `core.autocrlf=true` clone of a commit carrying this change checks out 2,195 files with
  LF, passes `pnpm format:check`, and passes `pnpm vitest run tests/docs`; in the working tree, a
  record rewritten with CRLF still passes the documentation tests.
- Against a production build the end-to-end suite was green twice at six workers and three times at
  twelve; against `next dev` it failed at every count tried — three failures at six, thirteen at
  twelve, two at four, three at two. `pnpm test:e2e`, which now builds and serves the application
  itself, passed twice: 26 passed and 1 skipped at six workers, the skip being flow 1's
  registration, which correctly skips on an instance that already has an owner.
- The E2E workflow reproduced locally — its Compose files under an isolated project with the ports
  remapped, the images built from this change — passed 27 of 27 with nothing skipped: flow 4 ran and
  passed, and flow 1 registered the fresh instance's owner. The same spec with the workflow's old
  `REDIS_URL` skipped.
- `scripts/check-changelog.ts` against a scratch clone's real history: a branch touching
  `features/invoices/mutations.ts` without an Unreleased entry exited 1 naming the file, the same
  branch with an entry exited 0, and a documentation-only branch exited 0 as not required.
- A development server started against a scratch database holding ten of the eleven migrations
  logged "The database is behind on migrations: 1 pending" at boot, before serving any request.
  Started against a database that was not listening, it was ready in 613ms and logged that it could
  not check.
- `pnpm typecheck` passes; `pnpm lint` reports no errors and only its two standing `max-lines`
  warnings in `features/templates`; react-doctor reports no error and none of its 26 standing
  warnings on a file this change touched; fallow reports no unused export or file in it and still
  exits 1 on its standing advisory backlog, where the changelog command's wrapper now joins the
  untested-complexity list beside the other operator entry points.

Some runs were discarded rather than counted. Docker restarted during one integration batch and left
the test services down. In another, a run overlapped an image build that saturated the disk: five
tests timed out in the shared truncating `beforeEach` of `tests/integration/setup.ts`, whose normal
cost is about 0.4s, and one timed out in its body. That batch was then invalidated by a query run by
hand against the same database mid-run. Both batches were repeated in full with nothing else
running.

## Known gaps

None.
