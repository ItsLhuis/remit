# DR-0032: Documentation reconciliation

- **Status:** Shipped
- **Date:** 2026-09-03
- **Verdict:** Complete with known gaps
- **Decisions:** ADR-0010, ADR-0014, ADR-0018, ADR-0023, ADR-0025
- **Supersedes:** —

## What

`README.md`, `docs/architecture/ARCHITECTURE.md` and `docs/architecture/SCHEMA.md` describe only
what the repository contains, in the present tense, and a test holds `SCHEMA.md` to the Drizzle
schema column by column.

## Why

The three documents were forward-looking by design: `ARCHITECTURE.md`'s own preamble declared that
"what is written here is what the code must implement". A reader could not tell a promise from a
fact, because both were written in the present tense and neither was marked. Eleven capabilities
were described as shipped and did not exist — among them the `/s/[token]` client portal, public
token rotation, Stripe hosted checkout, automatic late fees, restore from trash, report PDF export
and the public REST API — and two security statements described controls the code does not
implement.

A marker convention would not have fixed it, because a marker only helps a reader who knows to look
for one. Removing what is not built is the only posture a reader needs no convention to use.

## Scope

Included: the posture change and its three structural passages (`ARCHITECTURE.md`'s preamble, its
closing paragraph, section 3's divergence rule); removal of every capability verified absent;
rewriting of every partially wired claim to the half that exists; `SCHEMA.md` reconciled against
`database/schema/**`; `ARCHITECTURE.md`'s prose restatements of the audit-log, encryption, export,
event-bus, route-table, entity-relationship and lifecycle schemas checked against the code; the
proposal-versioning invariant settled; and one documentation-consistency test.

Excluded, deliberately: building any of the removed capabilities — each is its own later delivery,
and the document each one needs is written back when its code is real. Also excluded: editing any
ADR. A shipped ADR is immutable, so ADR-0010's restore promise stays where it is and the
reconciliation happens in `ARCHITECTURE.md` prose instead. Also excluded: the code-level defects the
sweep turned up, which are recorded under **Known gaps** rather than fixed, because a documentation
pass that also changes behaviour cannot be reviewed as either.

## How

The posture is one sentence — _a capability that is not built is not in these documents_ — and the
work was mostly finding out which capabilities those were. Each claim was traced route → query or
mutation → service → schema → test before a word was cut, because the failure mode being fixed is
exactly a document trusted over the code.

Three passages had to change before any other edit was coherent, since until they did the document
contradicted its own new rule: the preamble, the closing paragraph, and section 3's rule that a
schema lagging the domain model "is expected". That rule now makes divergence a defect in either
direction.

Removal, not marking, is the whole point. A "planned" marker still puts the capability in the
reader's head and still has to be believed or disbelieved; an absent paragraph asks nothing. What a
removal loses is the record that somebody once intended the thing — which is why a decision that has
genuinely been taken goes to an ADR, and ADR-0010 is the precedent: soft delete shipped, restore did
not, and the ADR is where the unbuilt half still lives.

Where a capability is half-wired, the document now states the half that exists in unflattering terms
rather than dropping the subject. `clients.portal_token` has no writer, `invoices.late_fee_cents`
has readers and no writer, ten `settings.backup_*` columns have no editing surface, and
`SENTRY_DSN`, `REMIT_METRICS_TOKEN` and `REMIT_HOSTED_MODE` validate at boot and are read by
nothing. Each of those is a fact about the repository, and an operator who sets one of the three
variables and sees no effect is otherwise left debugging their own deployment.

The test parses both sides from source rather than importing the Drizzle schema, because importing
`@/database/schema` pulls in `lib/config/env`, which exits the process when the environment is not
set — the same reason `features/dataExport/__tests__/manifest.integration.test.ts` runs in the
integration project. Parsing keeps this one in the unit suite, where a documentation check belongs.
The parser refuses any column entry it cannot classify instead of skipping it, so an unrecognised
shape fails the suite rather than silently dropping out of the comparison.

## Evidence

- Posture: `docs/architecture/ARCHITECTURE.md` preamble, its closing paragraph, and section 3's
  "Domain model vs. database schema".
- Schema reconciliation: `two_factors.verified`, `failed_verification_count` and `locked_until`
  added to `SCHEMA.md` section 3 from `database/schema/auth.ts`, marked as the installed Better Auth
  plugin's contract rather than Remit's own.
- Prose restatements corrected against code: the `audit_logs` column list in section 9 (`actor_role`
  was missing, from `database/schema/auditLogs.ts`); the data-export inclusion lists against
  `features/dataExport/services/exportInstanceTables.ts` and `exportSubgraphTables.ts`
  (`client_contacts`, `attachments` and `email_logs` were absent, and `activity_logs`, `uploads` and
  `email_logs` were grouped as instance-scope when they are client-scoped); the event names in
  section 8 against `lib/events/types.ts`; the API route table in section 12 against the ten
  `route.ts` files under `app/`; the entity-relationship diagram and lifecycle diagrams against
  `database/schema/enums.ts` and the column names in `database/schema/`.
- Event bus: `lib/events/bus.ts` runs handlers under one `Promise.all`, not "in series" as the bus
  properties table claimed; `features/activityLog/events.ts` is the only subscriber, and the
  `invoice.paid` fan-out example named four handler files that do not exist.
- Rate limiting: the coverage table in section 9 is built from `proxy.ts` (public token routes,
  `/invite/`), `lib/auth/index.ts`'s `rateLimit` block, `app/(public)/p/[token]/otp/*/route.ts`,
  `app/(public)/c/[token]/sign/route.ts` and `app/api/webhooks/stripe/route.ts`.
- Encryption-at-rest table checked against the eight `encryptedColumn()` declarations in
  `database/schema/`.
- Proposal locking: `features/proposals/publicResponse.ts` sets `locked_at` on acceptance.
- Test: `tests/docs/schema.test.ts`.

## Verification

`pnpm typecheck`, `pnpm lint` (2 pre-existing `max-lines` warnings in `features/templates/`, no new
ones), `pnpm format:check`, `pnpm test` (223 files, 2008 tests) and `pnpm build` all pass.
react-doctor scores 88/100 with no finding in a file this record touched. fallow's totals moved from
369 to 368 above threshold, so the new test is net-negative against the existing backlog.

The new test was observed failing in both directions before it was trusted: adding an undocumented
column to `database/schema/taxRates.ts` failed it with `tax_rates.drift_probe`, and adding a row to
`SCHEMA.md` for a column that does not exist failed it with `tax_rates.ghost_col`. Both reverted and
the suite returned to green.

What is not covered: the test compares table and column names only. Types, nullability, defaults,
constraints and indexes are not checked, because each side expresses them in a different vocabulary
— a Drizzle builder name against a SQL type — and the mapping between them would be a second copy of
the document rather than an independent check of it. A route-table check of section 12 against
`app/**` was considered and not written: the table carries a purpose per row that no test can
derive, so it would assert only the paths, and the paths are the half that rarely drifts.

## Known gaps

Found while verifying, real, and deliberately not fixed here, because changing behaviour in a
documentation pass makes both halves unreviewable:

- `proxy.ts` deletes `X-Frame-Options` on public token routes while the CSP's
  `frame-ancestors 'none'` stays unconditional, so the intent to allow embedding there is not
  achieved. Documented as it behaves.
- `tests/docs/delivery.test.ts` splits on `"\n"` and finds its section headings with
  `indexOf("\n## …\n")`, so every record fails on a CRLF checkout. The repository has no
  `.gitattributes` and `core.autocrlf` is `true` on Windows, so `pnpm format` rewrites every file's
  line endings and `pnpm format:check` fails on a fresh Windows clone before any edit is made.
- `lib/jobs/types.ts` carries a comment referencing "Stages 12 and 16", a transient artefact that
  `.agents/rules/comments.md` forbids.
- `app/api/upload/__tests__/upload-routes.test.ts` failed once on a presigned-URL assertion and
  passed on every subsequent run.
- `.agents/rules/testing.md` names five canonical end-to-end flows; one exists and runs as far as
  the TOTP QR step. The rule file was left as the place that commitment lives.
