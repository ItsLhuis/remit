# restructure-reference-docs

## Product position

`docs/` holds 419,255 bytes in 15 files besides the two folders `retire-adrs-and-delivery-records`
deletes and the gitignored scratch folder. Two thirds of it (`ARCHITECTURE.md` 142,000 bytes,
`SCHEMA.md` 149,308 bytes) restates what `database/schema/`, `AGENTS.md`, `.agents/rules/`, the lint
config and the tests already say, and the copies drift: this proposal lists 19 statements in
`ARCHITECTURE.md`, 2 in `SCHEMA.md`, 4 in operator documents and 2 in guidance files that the code
contradicts. An agent that reads them is misled; one that does not misses nothing.

Admission test for every document and section: **a reader who lacks the text gets stuck or misled,
and the code, the tests and the lint rules do not say it.** What passes stays: operator runbooks,
deployment guides, two contracts, and the standing principles a short map carries. What fails is
deleted, after the few facts that exist only in prose move next to the code they describe. Owners
and agents gain one checked source per fact; operators keep every runbook, with its drift fixed.

## Scope

- In:
  - Delete `docs/architecture/SCHEMA.md` and `tests/docs/schema.test.ts`, after moving six facts
    into schema comments and re-pointing eight code comments.
  - Rewrite `docs/architecture/ARCHITECTURE.md` as a map of at most 20 KB (outline below), fixing
    every drift item it would otherwise carry.
  - Move operator text out of `ARCHITECTURE.md` into `docs/deploy/README.md`,
    `docs/operations/METRICS.md`, `docs/operations/UPGRADE.md` and a new
    `docs/operations/BACKUP.md`.
  - Shrink `CLI-CONTRACT.md` and `BACKUP-ARCHIVE.md` to what code cannot say, and place them per the
    chosen layout.
  - Fix the operator-document drift; add execution statements; fold the Raspberry Pi guide.
  - Delete `docs/README.md`; `README.md` routes. `AGENTS.md` points to each mechanism document from
    where an agent meets the problem.
  - Re-point every inbound link and every code comment that cites a deleted or renumbered section.
  - Three tests: relative links and cited doc paths resolve; `remit:*` packaging agrees;
    `audit_logs` is insert-only.
- Out: application behaviour (outside `docs/`, guidance files and tests, every diff is
  comment-only); `openspec/specs/`; `.agents/rules/` except re-pointing links and the stale facts
  beside those links (G2 below); released `CHANGELOG.md` entries; gitignored scratch files.

## Capabilities touched

- none

## Spec impact

- Added: none
- Modified: none
- Removed: none
- Unchanged behaviour that must survive: the whole application; every operator procedure stays
  documented; the path `docs/operations/UPGRADE.md`, which
  `features/health/services/releaseLinks.ts` builds into an in-app URL and `scripts/host/install.sh`
  prints.

## Inventory of `docs/`

Format: path, bytes (`wc -c`), audience (O owner, A agent, Op operator, C contributor); admission
test; verdict.

- `docs/README.md`, 2,214, C/Op. No: `README.md` (Documentation) already routes to every target.
  **Delete.**
- `docs/architecture/ARCHITECTURE.md`, 142,000, A/C. Partly: principles and flows pass, the rest
  restates code (disposition below). **Shrink to a map of about 18.9 KB.**
- `docs/architecture/SCHEMA.md`, 149,308, A/C. No: every section derives from `database/schema/`
  (disposition below). **Delete.**
- `docs/architecture/operations/CLI-CONTRACT.md`, 26,010, C/A. Partly: naming, promotion criteria,
  execution context, the no-`remit:upgrade` boundary and key-rotation semantics are stated nowhere
  else; flag lists repeat each command's `--help` (`scripts/core/*/args.ts`). **Shrink to about 8
  KB; place per Layout.**
- `docs/architecture/specs/BACKUP-ARCHIVE.md`, 11,509, C/Op. Partly: the forward-compatibility
  promise and the destination table pass; the byte layout is `scripts/core/archive/header.ts` and
  the manifest is `scripts/core/restore/manifestSchema.ts`. **Shrink to about 3 KB; place per
  Layout.**
- `docs/deploy/README.md`, 6,833, Op. Yes: the Tested label and the five operator obligations.
  **Keep; fix O1; receives Docker-first deployment.**
- `docs/deploy/linux-host.md`, 12,613, Op. Yes: platform runbook with an execution record. **Keep;
  fix O1, O2.**
- `docs/deploy/nginx.md`, 8,909, Op. Yes: the proxy block and forwarded headers are nowhere else.
  **Keep; fix O1.**
- `docs/deploy/cloudflare-tunnel.md`, 8,394, and `docs/deploy/coolify-and-dokploy.md`, 9,142, Op.
  Yes, marked Not tested. **Keep.**
- `docs/deploy/raspberry-pi.md`, 6,512, Op. Weak: mostly "follow linux-host"; its own facts are
  arm64 images and Chromium. **Fold into `linux-host.md`** (question 4).
- `docs/operations/INSTALL.md`, 17,175, Op. Yes: key custody, re-run semantics, manual install, S3
  permissions. **Keep; fix O2.**
- `docs/operations/UPGRADE.md`, 5,591, Op. Yes: rollback and "update the checkout first". **Keep;
  receives Updates.**
- `docs/operations/RESTORE.md`, 9,462, Op. Yes: destructive scope, bucket ownership, step order.
  **Keep.**
- `docs/operations/METRICS.md`, 3,583, Op. Yes: scrape config, alert meanings, "404 means the token
  is missing". **Keep; receives Health and status, What an operator can observe.**

Estimated result: about 110 KB in `docs/` plus about 11 KB next to code.

## `ARCHITECTURE.md` disposition

142,000 bytes in 111 segments; a segment runs from its heading to the next, so a `##` line counts
only its lead text. Format: section (bytes): verdict — evidence. Verdicts: **keep**, **shrink** (to
a principle plus a pointer), **delete** (derivable from the evidence), **move to** a runbook.
Consecutive sections with the same verdict are grouped.

- Preamble (1,382): shrink — `AGENTS.md` (Rules, References).
- Table of contents (1,024): delete — the map's own headings.
- 1 lead (1,747): shrink — `AGENTS.md` lines 3-6, `README.md`.
- Primary workflow (918): delete — `AGENTS.md` ("Every stage ... is optional"); nullable parent
  foreign keys in `database/schema/*.ts`.
- What Remit is not (1,457): shrink — `database/schema/clientContacts.ts`; no `features/contacts/`.
- 2 lead (156): delete — `AGENTS.md` Hard rules.
- Principles 1-2, data ownership and single instance (1,093): shrink — `lib/config/envSchema.ts`
  (every provider optional); `AGENTS.md` Hard rules (no `tenantId`).
- Principles 3-8 (2,087): delete — `.agents/rules/architecture.md`, `eslint.config.mjs`
  (`featureBoundaryRule`, `pureServicesRule`), `.agents/rules/types.md`, `remit/validate-before-io`,
  the CLI contract.
- 3 lead, Entity relationships (4,625): delete — `database/schema/*.ts`, `relations.ts` (A11).
- Entity lifecycle states (1,461): shrink — `database/schema/enums.ts`,
  `features/invoices/services/invoiceStatusView.ts`, `isProposalExpired` in
  `features/proposals/services/proposalNumber.ts`.
- Key invariants (4,306): keep, trimmed of the bullets rules already state —
  `features/invoices/billing.ts`, `features/proposals/publicResponse.ts`, migrations `0001`, `0002`;
  cited by `features/invoices/invoiceWrites.ts:45` and `services/billableConversion.ts:234`.
- Domain model vs. database schema (921): delete — `AGENTS.md` ("Done means"), `database/schema/`.
- 4 lead (27): delete — heading only.
- High-level architecture (3,370): keep, redrawn — `docker-compose.yml` services; the `app/` groups
  (A5).
- Technology stack (2,491): delete — `package.json`, `AGENTS.md` Stack.
- 5 lead, Feature module shape (1,438): delete — `.agents/rules/architecture.md`, the fuller copy
  (A2).
- The boundary rule (617): shrink — `eslint.config.mjs:163-187`, `.oxlintrc.json` (A1).
- Why closed modules, Feature inventory (1,055): delete — `.agents/rules/architecture.md`;
  `features/` (the monorepo rule: question 5).
- 6 lead and its four subsections (3,189): delete —
  `.agents/rules/{architecture,actions,queries}.md`, `pureServicesRule` (A3, A18).
- 7 lead, Schema organisation, Universal table conventions, Money storage (3,122): delete —
  `.agents/rules/database.md`, `database/schema/helpers.ts`, `.agents/rules/money-and-dates.md`
  (A9).
- The `encryptedColumn()` helper (753): shrink — `database/schema/helpers.ts`, `lib/encryption/`,
  `INSTALL.md` (key custody).
- Migrations strategy (1,190): delete — `drizzle/migrations/meta/_journal.json`,
  `.agents/rules/database.md` (A10; the two-release rule: question 6).
- 8 lead (17): delete — heading only.
- Purpose (686): shrink — `lib/events/bus.ts`, `.agents/rules/events.md`.
- Event naming convention (1,518): delete — `lib/events/types.ts`, `.agents/rules/events.md` (A6).
- Who subscribes (1,747): shrink — `instrumentation.ts`,
  `scripts/core/worker/loadWorkerFeatureModules.ts`, `features/activityLog/events/index.ts` (A17).
- Bus properties (1,436): delete — `lib/events/bus.ts`, `lib/events/__tests__/bus.test.ts`.
- 9 lead (178): delete — rhetoric only.
- Authentication flow (663): shrink — `app/api/auth/[...all]/route.ts`, `lib/auth/index.ts` (A6).
- Better Auth ownership, Password reset paths, Encryption at rest (2,895): delete —
  `.agents/rules/auth.md`, `lib/auth/__tests__/passwordReset.integration.test.ts`, the nine
  `encryptedColumn(` calls in `database/schema/`.
- The two audit logs, Public token security, Private files and attachments, Rate limiting, What an
  assistant can read (11,900): shrink — migration `0001`, `lib/audit/`; `lib/publicToken.ts` and its
  test; `app/api/{storage,upload,attachments}/**`,
  `features/clients/__tests__/publicPortal.integration.test.ts`; `lib/rateLimit/`,
  `lib/auth/__tests__/rateLimit.integration.test.ts`;
  `features/mcp/__tests__/mcpExposure.integration.test.ts`.
- HTTP security headers (2,399): delete — `lib/securityHeaders.ts`,
  `tests/applySecurityHeaders.test.ts`, `__tests__/proxy.test.ts`.
- Routing state rule, Data export and deletion (8,196): shrink — `proxy.ts` and its test (A7);
  `features/dataExport/services/exportManifest.ts` and its test, `features/trash/services/`,
  `features/clients/forget.ts`, `scripts/core/domainData/inventory.ts` and its test.
- 10 lead, Why this section exists (426): delete — `AGENTS.md` Hard rules.
- The roles (775): keep — no single file states the policy; it is spread over eight
  `features/*/mutationContext.ts` and `features/api/services/apiAccess.ts`, which cite it.
- Implementation: organization plugin (2,131): delete — `.agents/rules/auth.md`,
  `database/schema/organizations.ts`, `lib/auth/index.ts`.
- Authorization model (2,482): shrink — `lib/auth/session.ts`, `features/*/mutationContext.ts`,
  `.agents/rules/actions.md` (A8).
- Invitation flow, What multi-user does not change (3,056): delete — `features/team/mutations.ts`,
  `app/(auth)/invite/[invitationId]/page.tsx`, `.agents/rules/auth.md`.
- 11 lead and its six subsections (3,530): delete —
  `.agents/rules/{components,forms,hooks,accessibility}.md`, `jsx-a11y/*`, `app/globals.css` (A4).
- 12 lead (20): delete — heading only.
- Server actions vs. API routes (3,532): shrink — `app/**/route.ts`, `.agents/rules/routes.md`,
  `AGENTS.md` Hard rules.
- Public API, Outbound webhooks, MCP server, Validation at every boundary (4,809): delete —
  `features/api/` and `routes.integration.test.ts`, `features/webhooks/safePost.ts` and its tests,
  `features/mcp/` and `mcpServer.integration.test.ts`, `remit/validate-before-io`.
- 13 lead (38): delete — heading only.
- Docker-first deployment model (1,871): move to `docs/deploy/README.md`.
- Configuration hierarchy (976): shrink — `lib/config/envSchema.ts`, `.agents/rules/architecture.md`
  (Adding an environment variable).
- Data residency (1,265): keep — stated by no code or test; `lib/metrics/collectMetrics.ts:36` cites
  it.
- 14 lead (1,979): delete — `package.json` (`remit:*`), the CLI contract's status matrix.
- One-command install, Setup wizard (2,331): delete — `INSTALL.md`; `features/setup/`, `proxy.ts`.
- Health and status (567): move to `docs/operations/METRICS.md`.
- Operational CLI contract, Instance data reset (1,994): delete — the CLI contract;
  `scripts/core/domainData/inventory.ts` and its test.
- Backup and restore (4,818): move to `docs/operations/BACKUP.md` (new; question 3).
- Updates (1,952): move to `docs/operations/UPGRADE.md`.
- Encryption key rotation, Operator documentation, Deployment guides (2,246): delete — the CLI
  contract (`remit:rotate-encryption-key`); `README.md` Documentation; `docs/deploy/README.md`.
- 15 lead (29): delete — heading only.
- Two distinct locale concerns (858): shrink — `database/schema/settings.ts` (`default_locale`),
  `database/schema/clients.ts` (`locale`).
- App UI language stack, Type-safe message keys, File layout, Activity log and message keys,
  Deferred decisions (2,763): delete — `lib/i18n/`, `.agents/rules/i18n.md`,
  `features/activityLog/__tests__/localeIndependence.test.ts` (A19).
- 16 lead, Structured logging (493): delete — `lib/logger/index.ts`, `.agents/rules/errors.md`
  (A12).
- What an operator can observe (537): move to `docs/operations/METRICS.md`.
- Error tracking, Metrics (9,613): shrink — `lib/errorTracking/errorEvent.ts` and its test,
  `lib/jobs/worker.ts`; `lib/metrics/admission.ts`, `handleMetricsRequest.test.ts` (A13).
- 17 lead and its three subsections (4,015): delete — `.agents/rules/testing.md`, `tests/e2e/`,
  `.github/workflows/` (A14, A15).
- 18 lead (327): delete — `AGENTS.md` Hard rules (per-instance isolation).
- The commitment (1,469): shrink — `lib/config/envSchema.ts` (`REMIT_HOSTED_MODE`),
  `features/settings/backup/`, `features/backups/` (A16).
- 19 Open architectural questions (823): delete — `openspec/backlog.md`.
- 20 (10,211): removed by `retire-adrs-and-delivery-records`.

Totals: keep 4 sections, 9,716 → about 7,200 bytes; shrink 25 sections, 50,632 → about 9,400; delete
76 sections, 61,696; move 5 sections, 9,745, edited to fit their runbooks; section 20, 10,211, goes
with the sibling change. About 2,300 bytes are new (request flow, job flow). Map: about 18.9 KB; if
it runs over, cut the Key invariants bullets a schema constraint enforces.

## `SCHEMA.md` disposition

`tests/docs/schema.test.ts` parses `pgTable(...)` column names from `database/schema/*.ts` and the
`Column` cells of `SCHEMA.md`, and asserts the same table set, no missing and no invented column. It
checks no type, nullability, default, foreign key, index, check, enum, trigger or prose, and never
connects to a database: it guards the document, not the database. Deleting both loses no database
property. The one database property no test guards is the `audit_logs` insert-only triggers
(`drizzle/migrations/0001_insert_only_guards.sql`); this change adds that test in the shape of
`features/contracts/__tests__/signedPdfGuard.integration.test.ts`.

Every section: **delete**, derivable from the named file in `database/schema/` unless stated.

- Preamble, table of contents (2,067): navigation; anchors from item 10 on point one number high.
- 1 Conventions (1,581): `.agents/rules/database.md:17-31,52`, `.agents/rules/security.md`.
- 2 Universal helpers (419): `helpers.ts`.
- 3-4 Auth and organization tables (13,486): `auth.ts`, `organizations.ts`.
- 5-6 Audit and activity logs (3,821): `auditLogs.ts`, `activityLogs.ts`, `enums.ts`, migration
  `0001`.
- 7 Settings (22,415): `settings.ts`, whose 44 comment lines carry the reasons; false statement S1.
- 8 Tax rates (829): `taxRates.ts`.
- 9 Templates (7,402): `features/templates/schemas.ts`, `services/blocks.ts`; fact F5 moves first.
- 10 Uploads (2,884): `uploads.ts`, `lib/storage/objectDeletions.ts`; its section link is broken.
- 11 Email logs (2,381): `emailLogs.ts`; fact F6.
- 12-15 Leads, clients, client contacts, projects, tasks (16,076): `leads.ts`, `clients.ts`,
  `clientContacts.ts`, `projects.ts` with migration `0002`, `tasks.ts`.
- 16 Time entries (4,325): `timeEntries.ts`; fact F3.
- 17 Expenses (2,967): `expenses.ts`.
- 18-19 Proposals, proposal OTPs (11,456): `proposals.ts`, `proposalOtps.ts`; facts F1, F2.
- 20-22 Contracts, contract signatures, recurring invoices (8,908): `contracts.ts`,
  `contractSignatures.ts` with migration `0001`, `recurringInvoices.ts`.
- 23 Invoices (14,720): `invoices.ts`, `features/invoices/services/lateFee.ts`; fact F4; false
  statement S2.
- 24-26 Line items, payments, credit notes (8,079): `lineItems.ts`, `payments.ts`, `creditNotes.ts`.
- 27-33 Data and report exports, attachments, API tokens, webhooks, object deletions (16,846):
  `dataExports.ts`, `reportExports.ts`, `attachments.ts`, `apiTokens.ts`, `webhooks.ts`,
  `objectDeletions.ts`.
- 34 Enum reference (8,646): `enums.ts`; computed statuses in `invoiceStatusView.ts`.

Totals: 149,308 bytes deleted in 74 segments; nothing kept, shrunk or moved. About 1 KB of facts
moves into schema comments first (none of them is a comment today):

- F1 `proposals.ts`: `locked_at` is set on acceptance and never changes afterwards.
- F2 `proposals.ts`: conversion is recorded on `invoices.proposal_id` and `contracts.proposal_id`;
  `proposals` has no `converted_to_*` column.
- F3 `timeEntries.ts` (or `lineItems.ts`): `time_entries.invoiced_in_id` is canonical;
  `line_items.source_*` is per-line provenance that neither mirrors nor derives from it.
- F4 `invoices.ts`: `pdf_upload_id` is cleared only when a late fee is charged or adjusted;
  `amount_paid_cents` plus live credit notes decide `paid`.
- F5 `templates.ts`: `is_system` has no writer; built-in layouts live in code and are never seeded.
- F6 `emailLogs.ts`: "insert-only after the final state" is not enforced; state it as a convention
  or drop it (recommended: drop).

False statements, deleted with the document: S1 `backup_cadence` is "consumed by no scheduler", yet
`features/backups/jobs.ts` and `lib/jobs/schedules.ts` read it; S2 the invoices note says no
hard-delete path exists, yet `features/trash/purge.ts` is one.

Code comments that cite `SCHEMA.md` and must name the schema file or service instead:
`features/activityLog/mutations.ts:94`, `features/clients/publicQueries.ts:229`,
`features/invoices/jobs.ts:55`, `features/invoices/services/invoiceStatusView.ts:12`,
`features/proposals/mutations.ts:289`, `features/proposals/publicLink.ts:125`,
`features/proposals/queries.ts:171`, `features/proposals/types.ts:130`.

## Drift to resolve

The executing agent fixes each item in text that survives, or confirms it leaves with a deleted
section. A: `ARCHITECTURE.md`; G: guidance; O: operator documents.

- A1 Boundaries are `no-restricted-imports` with `featureBoundaryRule`, not
  `eslint-plugin-boundaries`; there are four doors (`index`, `server`, `systemWrites`, `services`).
- A2 The module shape omits `server.ts`, `systemWrites.ts`, `jobs.ts`, `public*.ts`,
  `mutationContext.ts`.
- A3 `features/invoicing/`, `features/recurring/` and `computeInvoiceableEntries` do not exist.
- A4 Every path in Component hierarchy is wrong; components live in `features/invoices/components/`.
- A5 Route groups are `(auth) (dashboard) (editor) (public)`; `/setup` is
  `app/(auth)/setup/page.tsx`; the diagram omits the worker, Redis, the object store and Caddy.
- A6 Sign-in is `/api/auth/sign-in/email`, audited by `writeAudit` in
  `app/api/auth/[...all]/route.ts`; the five `auth.*` events in `lib/events/types.ts` are never
  emitted.
- A7 The routing state machine omits the membership gate and the `mustChangePassword` redirect;
  business profile and TOTP are one `setupComplete` predicate; the file is `proxy.ts`.
- A8 No proxy-level role gating exists; settings pages call `requireRole`.
- A9 Foreign keys have no cascade default (25 cascade, 35 set null).
- A10 There are 13 migrations, three hand-written (`0001`, `0002`, `0011`); the migrator compares
  `created_at`, not a hash.
- A11 `line_items.quantity` is `numeric(10,2)`, not an integer.
- A12 No `requestId` exists anywhere in the code.
- A13 There are six scheduled sweeps, including `storage.deletion.sweep` (`lib/jobs/schedules.ts`).
- A14 `tests/e2e/` has twelve template-editor specs plus two backup specs.
- A15 CI runs `pnpm test:coverage` and gates lint, typecheck, build and `changelog:check`;
  `install.yml` exists.
- A16 `features/backups/jobs.ts` and `queries.ts` also branch on hosted mode.
- A17 Subscribers load through `scripts/core/worker/loadWorkerFeatureModules.ts`.
- A18 `public*.ts`, `jobs.ts`, `systemWrites.ts`, `proxy.ts` and `scripts/` also read with Drizzle.
- A19 `lib/i18n/i18n.ts` and `lib/i18n/server.ts` exist; there is a server-side translator.
- G1 The `AGENTS.md` directory map names a `(setup)` route group that does not exist.
- G2 `.agents/rules/security.md:14` points at the deleted encryption table and lists six of nine
  encrypted columns (it misses `backup_s3_access_key`, `backup_s3_secret_key`,
  `webhook_endpoints.secret`): replace the list with a pointer to `encryptedColumn(` in
  `database/schema/`. `security.md:84-86` names `POST /login` and `POST /register`: name the real
  Better Auth routes. `security.md:98` points at the Routing state rule: point at its map section.
- O1 `docs/deploy/README.md` (five things, item 5), `linux-host.md:206-219,243-244` and
  `nginx.md:178` say a new instance renders no PDF and logs
  `Invoice PDF skipped: no template to render`. The code falls back to a built-in layout
  (`features/invoices/pdfRenderJob.ts:50-52`, `features/invoices/emailJob.ts`) and the string exists
  nowhere. Both Tested labels predate it.
- O2 `INSTALL.md:101-102` and `linux-host.md:178-179` say `RESTORE.md` describes how to test a
  backup; it does not.
- O3 `CLI-CONTRACT.md:341` says compose starts the worker with `entrypoint:`; the entrypoint is the
  worker image's own `ENTRYPOINT` (`Dockerfile:102`).
- O4 `CLI-CONTRACT.md`, scheduled backup (about line 350): re-verify the lock wording against
  `features/backups/jobs.ts:126-142` and the backup and rotation lock modules.

## Operator documents: what each needs to be trusted

Listed, not fixed here; the tasks do the work.

- `INSTALL.md`. Executed by CI `.github/workflows/install.yml` (unattended path) and
  `scripts/host/__tests__/install.test.ts`. Untested: the interactive path, Caddy and ACME, the
  manual install, external S3. Needs an execution statement naming the CI job and the unexecuted
  paths; O2.
- `UPGRADE.md`. Executed by `scripts/host/__tests__/upgrade.test.ts` (script sequence). Untested:
  rollback. Needs an execution statement with rollback marked unexecuted.
- `RESTORE.md`. Executed by `scripts/core/restore/__tests__/*` (the command) and one manual host run
  recorded in `linux-host.md`; CI stops at backup. Needs an execution statement and the backup-test
  procedure O2 promises (in `BACKUP.md`).
- `METRICS.md`. Executed by `lib/metrics/__tests__` (route behaviour). Untested: the Prometheus
  scrape config. Needs a statement whether it ran against Prometheus.
- `BACKUP.md` (new). Backed by `features/backups/` tests and `tests/e2e/scheduledBackup.spec.ts`.
  Untested: a real destination bucket. Needs an execution statement from the start.
- `docs/deploy/*`. No automation; labels record manual runs. Needs O1 fixed and each Tested label to
  name the commit it ran against.
- CLI contract. Only `tests/docs/demoSeeding.test.ts` reads it (one wording). Needs a test that
  `package.json` `remit:*` keys, `tsup.scripts.config.ts` entries and `Dockerfile` COPY lines agree;
  O3, O4.
- Archive format contract. The header is tested by
  `scripts/core/archive/__tests__/backupArchive.test.ts` and `manifest.test.ts`; no drift found.
  Needs nothing beyond the shrink.

## Layout

- (a) One central `docs/` as today: one place to browse, but mechanism documents sit far from the
  code that changes them and drift unseen.
- (b) Mechanism and contract documents next to the owning code; `docs/` keeps operator runbooks,
  deployment guides and the map. Benchmark (size and scope, not a template): a mature open-source
  monorepo keeps a ~5 KB agent file, enforces conventions in CI, and holds a handful of mechanism
  documents (~20 KB) inside the package they describe, with no per-feature specs.

Recommended: (b), narrowly. Contributor contracts move to the code they constrain: `CLI-CONTRACT.md`
→ `scripts/README.md`; `BACKUP-ARCHIVE.md` → `scripts/core/archive/README.md`. Everything an
operator reads stays in `docs/`: operators browse the repository, not the code tree, and
`UPGRADE.md`'s path is load-bearing. Metrics and deployment guides are operator runbooks and stay.

Either way, `AGENTS.md` gains a short Gotchas list pointing to each mechanism document where an
agent meets the problem: adding or changing a `remit:*` command → `scripts/README.md`; changing the
archive or its manifest → `scripts/core/archive/README.md`; changing what an operator runs on
install, upgrade or restore → its runbook in `docs/operations/`; moving `docs/operations/UPGRADE.md`
breaks `features/health/services/releaseLinks.ts` and `scripts/host/install.sh`. The relative-link
test that `retire-adrs-and-delivery-records` adds (`tests/docs/links.test.ts`) extends to
`scripts/**/README.md` and to every `*.md` repository path that a code comment, `AGENTS.md` or a
rule cites.

Inbound references that layout (b) breaks: `README.md:256,263,273,279`,
`tests/docs/demoSeeding.test.ts:19`, `scripts/core/restore/manifestSchema.ts:12`,
`lib/backups/destination.ts:137`, `scripts/core/seedDemo/plan.ts:547`.

Inbound references to re-point under either layout:

- Guidance and contributor text: `AGENTS.md:43,129`, `README.md:293-296`,
  `.github/CONTRIBUTING.md:18`, `.github/SECURITY.md:38`,
  `.github/ISSUE_TEMPLATE/feature_request.yml:10`, `.agents/rules/comments.md:79`,
  `.agents/skills/write-spec/SKILL.md:39`, `tests/docs/demoSeeding.test.ts:18`.
- Code comments citing `ARCHITECTURE.md` by section number or title: `features/backups/jobs.ts:31`,
  `features/backups/queries.ts:16`, `features/settings/backup/mutations.ts:232`,
  `features/settings/backup/queries.ts:17`, `features/clients/forget.ts:42`,
  `features/clients/publicQueries.ts:129`, `features/clients/mutationContext.ts:59`,
  `features/activityLog/events/index.ts:13`,
  `features/activityLog/hooks/useActivityTimelineItems.ts:24`,
  `features/activityLog/__tests__/localeIndependence.test.ts:15`,
  `features/api/services/apiAccess.ts:27`, `features/settings/api/mutations.ts:141`,
  `features/settings/mcp/mutations.ts:83`, `features/invoices/mutationContext.ts:93`,
  `features/invoices/invoiceWrites.ts:45`, `features/invoices/services/billableConversion.ts:234`,
  `lib/securityHeaders.ts:34`, `lib/metrics/collectMetrics.ts:36`,
  `lib/errorTracking/__tests__/errorEvent.test.ts:29`, `proxy.ts:24`. Section numbers do not
  survive: comments cite the map by section title only.

## Final tree and routing

```
docs/
  architecture/ARCHITECTURE.md    the map, at most 20 KB
  operations/                     INSTALL.md UPGRADE.md RESTORE.md BACKUP.md METRICS.md
  deploy/                         README.md linux-host.md nginx.md cloudflare-tunnel.md
                                  coolify-and-dokploy.md
scripts/README.md                 CLI contract: governance, execution context, key rotation
scripts/core/archive/README.md    archive compatibility promise and destination table
```

`docs/README.md` is deleted because `README.md` (Documentation) already routes. Its list becomes:
install → `INSTALL.md`; deploy on a platform → `docs/deploy/`; back up → `BACKUP.md`; restore →
`RESTORE.md`; upgrade → `UPGRADE.md`; monitor → `METRICS.md`; how the system fits together →
`ARCHITECTURE.md`; tables and columns → `database/schema/`; `remit:*` commands →
`scripts/README.md`; writing code → `AGENTS.md` and `.agents/rules/`.

Map outline, about 18.9 KB; every claim names the file that verifies it:

0. Scope of this map (300) — `AGENTS.md` (Rules, References).
1. What Remit is and is not (750) — `AGENTS.md`, `README.md`, `database/schema/clientContacts.ts`.
2. Standing principles (600) — `AGENTS.md` Hard rules, `lib/config/envSchema.ts`,
   `features/backups/jobs.ts`.
3. Processes and layers, one diagram (2,200) — `docker-compose.yml`, `proxy.ts`, the `app/` groups,
   `features/*/services/`, `scripts/worker.ts`.
4. Module boundaries (350) — `eslint.config.mjs` (`featureBoundaryRule`), `.oxlintrc.json`,
   `.agents/rules/architecture.md`.
5. Request flow (1,500) — `proxy.ts`, `lib/auth/session.ts`, `.agents/rules/actions.md`,
   `lib/events/bus.ts`, `app/**/route.ts`.
6. Job flow (1,000) — `lib/jobs/{enqueue,registry,schedules}.ts`, `features/*/jobs.ts`,
   `lib/jobs/__tests__/jobCatalog.integration.test.ts`.
7. Data model principles (4,300) — `database/schema/enums.ts`, `invoiceStatusView.ts`, migrations
   `0001` and `0002`, `features/invoices/billing.ts`, `exportManifest.ts`,
   `features/trash/services/`, `features/clients/forget.ts`.
8. Security model and roles (4,000) — `app/api/auth/[...all]/route.ts`, `lib/publicToken.ts`,
   `lib/rateLimit/`, `features/mcp/`, `proxy.ts`, `lib/auth/session.ts`,
   `features/*/mutationContext.ts`.
9. Locale (300) — `database/schema/settings.ts`, `database/schema/clients.ts`.
10. What leaves the instance (1,900) — `lib/errorTracking/errorEvent.ts` and its test,
    `lib/metrics/admission.ts` and its test, `features/webhooks/safePost.ts`.

## Open questions

1. Layout (a) central or (b) next to code? Recommended: (b) narrowly, as above.
2. Generate a schema diagram from `database/schema/`? Recommended: no. Nothing reads one today; a
   generated artefact needs a generator, a check and a home; `drizzle-kit studio` shows the live
   schema on demand.
3. A new `docs/operations/BACKUP.md`? Recommended: yes. No runbook holds the schedule
   (`backup.run.sweep` at 01:00 UTC), the single backup lock, the destination test, hosted mode, the
   dashboard banner, retention pruning, or the backup-test procedure `INSTALL.md` promises.
4. The Raspberry Pi guide? Recommended: fold its arm64-image and Chromium facts into an "arm64
   hosts" section of `linux-host.md` and delete the file; it is Not tested and otherwise defers to
   that guide.
5. Binding rules stated only in prose this change deletes or shrinks: no TOTP opt-out
   (Authentication flow); no monorepo until a second artefact (Why closed modules); no URL-based
   locale routing (Deferred decisions); no Docker socket and no `remit:upgrade` (Operational CLI
   contract, Updates); no placeholder `remit:*` script (CLI contract); no application cache (Rate
   limiting); no error-tracking SDK, build integration or browser DSN (Error tracking); built-in
   layouts never seeded as templates (`SCHEMA.md`). Recommended: the owner reviews the list in one
   pass; each kept rule becomes one line in the owning `.agents/rules/<name>.md` (a rule edit the
   owner approves here) or in the map's Standing principles; the rest is dropped.
6. The two-release migration rule (Migrations strategy, Updates) has no enforcing file and conflicts
   with owner decision 2 (pre-v1). Recommended: delete it.
7. Keep the CLI contract and the archive format as contracts? Recommended: yes, shrunk. The CLI
   contract keeps naming, promotion criteria, execution context, the no-`remit:upgrade` boundary and
   key-rotation semantics, and points to each command's `--help` for flags. The archive contract
   keeps the forward-compatibility promise and the destination table, and points to
   `scripts/core/archive/header.ts` and `scripts/core/restore/manifestSchema.ts` for the layout.
8. The two Tested deployment guides once O1 is fixed? Recommended: keep the label, add the commit
   each run used, and mark the corrected step as not re-executed until the owner re-runs the guide.

## Draft task outline

For `plan-change`; each line is one verified commit.

1. Schema facts: add F1-F5 as schema comments, resolve F6, re-point the eight `SCHEMA.md` code
   comments, add the `audit_logs` insert-only integration test, delete `SCHEMA.md` and
   `tests/docs/schema.test.ts`.
2. Prose-only rules: apply the owner's answers to questions 5 and 6 in `.agents/rules/`, or carry
   them into the map.
3. Runbooks: move Docker-first deployment to `docs/deploy/README.md`, Health and status and What an
   operator can observe to `METRICS.md`, Updates to `UPGRADE.md`; write `BACKUP.md` from Backup and
   restore plus the backup-test procedure.
4. CLI contract: shrink, move to `scripts/README.md`, fix O3 and O4, add the packaging agreement
   test, re-point its links and `demoSeeding.test.ts`.
5. Archive contract: shrink, move to `scripts/core/archive/README.md`, re-point `manifestSchema.ts`,
   `lib/backups/destination.ts` and `README.md`.
6. Map: rewrite `ARCHITECTURE.md` to the outline, resolving A1-A19; re-point every code comment
   listed under Layout to a section title; fix G2.
7. Operator documents: fix O1 and O2, add execution statements, fold the Raspberry Pi guide.
8. Routing: delete `docs/README.md`; update `README.md` Documentation, `AGENTS.md` (directory map,
   G1, References, Gotchas), `.github/CONTRIBUTING.md`, `.github/SECURITY.md`, the feature-request
   template, `comments.md:79` and `write-spec`; extend `tests/docs/links.test.ts` to the new
   locations and to doc paths cited in code comments.
9. Verify: `docs/` sizes against this proposal; the map at most 20 KB; a grep for `SCHEMA.md`,
   `CLI-CONTRACT`, `BACKUP-ARCHIVE` and numbered `ARCHITECTURE.md` sections finds nothing;
   `pnpm lint`, `pnpm typecheck`, `pnpm test`.

## Gate 1

pending
