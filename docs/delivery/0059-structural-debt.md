# Structural debt

- **Status:** Shipped
- **Date:** 2026-10-08
- **Verdict:** Complete
- **Decisions:** ADR-0023, ADR-0037
- **Supersedes:** —

## What

The workarounds earlier deliveries left in the code's shape — a copied response helper, a restated
contract rule, files split around the line ceiling, comments citing work orders, lint categories
held at `warn`, and a rate limiter built once per bundle — are replaced by the structure they stood
in for, with no change in behaviour.

## Why

Each workaround was reasonable on the day and had since become a precedent the next change would
copy. Eight public and download routes each carried their own copy of the helper that stamps
`X-Robots-Tag` on a JSON response. The client portal restated the contracts feature's expiry rule,
because importing it would have closed an import cycle, and a pin test kept the two copies equal.
Four features kept their restore actions in a `restoreMutations.ts` file only because their
`mutations.ts` had reached the 500-line ceiling, while eleven others kept restore beside soft
delete. `features/activityLog/events.ts` held every feed subscription for every emitting feature and
sat one handful of handlers short of the ceiling. Comments in code and tests explained themselves by
citing work-order stages, which `.agents/rules/comments.md` forbids and which mean nothing to a
reader without the gitignored prompts. Three lint categories still ran at `warn` though their
backlogs had reached zero, so a new violation would not fail `pnpm lint`. And `rateLimitInstance`
was built once per bundled module copy, so the proxy and the route handlers counted in separate
fallback stores and logged one Redis outage once per copy.

## Scope

Included: one shared `noindexJson` helper under `lib/utils/`; one definition of the contract display
status read by the portal; restore actions placed beside their soft deletes by a stated rule; the
activity-log subscriptions split by emitting feature behind one bootstrap import, with a test that
pins the subscribed event set; every work-order reference in code and tests rewritten to cite the
durable reason; `@typescript-eslint/no-deprecated`,
`@typescript-eslint/switch-exhaustiveness-check`, every `jsx-a11y/*` rule and
`i18next/no-literal-string` promoted to `error`; one rate limiter per process; and the rule files,
`AGENTS.md`, `ARCHITECTURE.md` and `SCHEMA.md` brought in line with each of these.

Excluded: behaviour of any kind — every change here is a move, a rename or a severity promotion
proven by the existing tests; the duplicated settings owner gate, which is a decision the owner has
not taken; the two `max-lines` warnings in the template editor, which belong to a separate split.

## How

**One response helper.** The eight copies were behaviourally identical — two spellings of a JSON
response with `X-Robots-Tag: noindex, nofollow` — so all eight became `noindexJson` in
`lib/utils/response.ts` and none stayed local. It is built on the web `Response` rather than
`NextResponse` because the `lib/utils` barrel is also loaded by client components; the status, body
and header are the same.

**One contract status rule, through a new door.** The cycle ran from the contracts barrel through
its components and `"use server"` mutations, into `features/proposals/server`, its public queries
and `features/clients/server`, and back to the portal. A pure `services/` module reaches none of
that, and `services/` files already imported each other's barrels under `pureServicesRule`. The
boundary rule now admits `@/features/<feature>/services` beside the root, server and `systemWrites`
doors, and the portal imports `resolveContractDisplayStatus` from there; the restated copy and its
pin test are gone. Moving only the contract mapper into `services/`, moving the recipient reads into
a new module, and deriving the status in the component were rejected: the first splits the portal's
row mappers across two layers, the second moves six importers to dodge a cycle, and the third moves
`now` to the browser's clock.

**Restore beside its soft delete.** In the four features whose `mutations.ts` reached the ceiling,
the soft delete and the restore now share a `trashMutations.ts`, the seam the trash lifecycle
already draws, and `actions.md` states the split: by concern into `<concern>Mutations.ts`, never by
moving an action away from the one it undoes. `remit/validate-before-io` now covers every
`*Mutations.ts`; it had covered only `mutations.ts`, so the old restore files and the image and
erasure modules carried no guard.

**One subscriber module per emitting feature.** `features/activityLog/events/` holds eleven modules,
each exporting a `subscribe…Activity()` function, and `index.ts` calls all of them, so
`@/features/activityLog/events` stays the single import `instrumentation.ts` and the worker load.
The shared `record` and lookups live in `record.ts`.

**Comments.** Each stage reference became the reason it stood for, cited by an ADR, a constraint or
a source file. Two of them sat on a fallback a valid row cannot reach, which the rewritten comment
now says, and the dead branch is left for its own change.

**Lint.** Every backlog was already zero, so the work was the promotion: the six `jsx-a11y` rules
`nextVitals` enables at `warn` are restated at `error` beside the ten the component block adds.
`i18next/no-literal-string` was promoted with them because `i18n.md` already called it a failing
rule and `pnpm lint` does not fail on a warning.

**One limiter per process.** A production build carries `lib/rateLimit/index.ts` under separate
Turbopack module ids — one shared by the route handlers, another for the SSR layer, and the proxy's
own `middleware.js` entry — in one Node process. `rateLimitInstance` is held on `globalThis` under a
`Symbol.for` key, the way `lib/events/bus.ts` holds the event registry, so every copy gets the same
adapter, connection, fallback store and outage log.

## Evidence

- `lib/utils/response.ts`, `lib/utils/index.ts`; the eight routes under `app/(public)/` and
  `app/api/` that import it.
- `features/clients/publicQueries.ts`, `features/clients/services/portalStatement.ts`,
  `eslint.config.mjs` (`featureBoundaryRule`), `.agents/rules/architecture.md` and `imports.md`
  ("Boundary rule", "Feature boundaries").
- `features/{clients,contracts,invoices,proposals}/trashMutations.ts`, each feature's `server.ts`,
  `features/clients/forgetMutations.ts`, `features/clients/mutationContext.ts`, `eslint.config.mjs`
  (`remit/validate-before-io` files), `.agents/rules/actions.md` ("Splitting `mutations.ts`").
- `features/activityLog/events/`, `.fallowrc.json`, `.agents/rules/events.md`,
  `docs/architecture/ARCHITECTURE.md` ("Who subscribes"), `docs/architecture/SCHEMA.md`,
  `database/schema/enums.ts`.
- The rewritten comments in `database/schema/attachments.ts`, `features/attachments/queries.ts`,
  `features/clients/publicQueries.ts`, `features/clients/trashMutations.ts`,
  `features/invoices/jobs.ts`, `features/invoices/queries.ts`,
  `features/payments/stripeCheckout.ts`,
  `features/proposals/{documentData,pdfDocument,overviewQueries}.ts`, `features/team/mutations.ts`,
  `lib/auth/index.ts`, `lib/jobs/{types,jobId}.ts`, `tests/e2e/support/jobWorker.ts`,
  `tests/factories/proposals.ts` and four test files.
- `eslint.config.mjs`, `AGENTS.md`, `.agents/rules/accessibility.md`.
- `lib/rateLimit/index.ts`.
- Tests: `lib/utils/__tests__/response.test.ts`,
  `features/activityLog/__tests__/eventSubscriptions.test.ts`,
  `lib/rateLimit/__tests__/redisAdapter.test.ts` (one limiter across module evaluations),
  `features/clients/__tests__/publicPortal.integration.test.ts` (an expired contract in the portal),
  and the existing route, mutation and activity-feed suites the moves run through.

## Verification

Nothing here changes behaviour, so the proof is that every existing suite passes unchanged across
the moves: `pnpm typecheck`; `pnpm lint` with no error and no warning in the promoted categories
(the backlog was zero before and after; the two `max-lines` warnings in the template editor are the
only warnings); `pnpm lint:cycles`; `pnpm test:coverage` (318 files, 2751 tests, thresholds held);
`pnpm test:integration` (100 files, 924 tests); `pnpm vitest run tests/docs`; `pnpm build`; and
`pnpm test:e2e` against the production build. An integration run that timed out one credit-note test
under load passed on its own and on a full re-run. Locally the end-to-end proposal flow needs a job
worker running, and passed with one; the registration flow skipped because the instance already has
an owner, and the two backup flows skipped because this host has no `pg_dump`.

The registration test was shown to fail when one subscriber call is removed from
`features/activityLog/events/index.ts`, and the production build was checked for the shared limiter
key in the proxy's chunks as well as the route and SSR chunks. fallow and react-doctor were compared
against an export of the previous commit: no new dead code, complexity or react-doctor finding, and
duplication fell from 345 clone groups to 342.

## Known gaps

None.
