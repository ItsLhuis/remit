# Remit architecture map

## Scope

This is the map of how Remit's parts fit together and the principle behind each. Every section names
the file that verifies it; when the two disagree, the file is right and this map is the defect.
Conventions for writing code are in `AGENTS.md` and `.agents/rules/`, table and column shapes in
`apps/web/database/schema/`, `remit:*` commands in `apps/web/scripts/README.md`, and operator
procedures in `docs/operations/` and `docs/deploy/`.

## What Remit is and is not

Remit is a self-hostable business management app for independent freelancers, covering the money
lifecycle from lead to payment (`AGENTS.md`, `README.md`). Every stage is optional: an invoice's
client and project keys are nullable (`apps/web/database/schema/invoices.ts`).

The people at a client are sub-records of that client
(`apps/web/database/schema/clientContacts.ts`), never a top-level entity: no
`apps/web/features/contacts/` exists and no other table references a contact.

Multi-user is three fixed roles inside one organization (`apps/web/lib/auth/index.ts`), not a team
tool.

## Standing principles

- One instance is one business. No table carries a `tenantId` and no query is scoped by tenant
  (`apps/web/database/schema/`, `AGENTS.md` Hard rules). Operating Remit for somebody else means one
  isolated instance per customer. `REMIT_HOSTED_MODE` (`apps/web/lib/config/envSchema.ts`) is read
  in four files, all for the backup destination: on a hosted instance the destination is the
  operator's, so `apps/web/features/backups/jobs.ts` skips the scheduled backup and
  `apps/web/features/settings/backup/mutations.ts` refuses writes. Nothing else branches on it.
- Email and payment providers are optional and configured in settings, not required to boot
  (`apps/web/database/schema/settings.ts`). Postgres, Redis and an S3-compatible object store are
  required: `apps/web/lib/config/envSchema.ts` exits the process without them.
- Secrets are encrypted at rest with `encryptedColumn(` (`apps/web/database/schema/helpers.ts`)
  under `REMIT_ENCRYPTION_KEY`; key custody is in `docs/operations/INSTALL.md`.
- Business rules are pure functions in `apps/web/features/<feature>/services/` (`pureServicesRule`
  in `eslint.config.mjs`). The framework-free helpers they share are `packages/core`
  (`pureCoreImportRule` and `pureCoreGlobalsRule` in `eslint.config.mjs`).
- Self-hosting operations are product work: backup, restore, reset, rotation and upgrade are
  `remit:*` commands and runbooks (`apps/web/scripts/README.md`, `docs/operations/BACKUP.md`,
  `docs/operations/UPGRADE.md`).

## Packages

The repository is a pnpm workspace (`pnpm-workspace.yaml`) of three private packages:

- `apps/web` (`@remit/web`) is the Next.js application: routes in `apps/web/app/`, closed feature
  modules in `apps/web/features/`, shared UI in `apps/web/components/`, server and client utilities
  in `apps/web/lib/`, Drizzle schemas in `apps/web/database/schema/` and migrations in
  `apps/web/drizzle/`, and the `remit:*` commands in `apps/web/scripts/`.
- `apps/worker` (`@remit/worker`) is the background job worker (`apps/worker/worker.ts`). It runs
  the job handlers of `apps/web` through that package's `exports` map (Module boundaries).
- `packages/core` (`@remit/core`) holds the pure helpers every layer shares: money parsing, date and
  time conversion, locale-aware formatting, CSV serialization, HTML escaping, URL checks and string
  helpers, imported through `packages/core/index.ts`. It imports no framework, database, IO,
  environment or `apps/*` module (`.agents/rules/architecture.md`).

Pure logic lives in two places: the shared helpers in `packages/core`, and each feature's business
rules in `apps/web/features/<feature>/services/`, which move into `packages/core` with the change
that rewrites them. The root keeps the repository tooling (ESLint, oxlint, Prettier, commitlint,
`tsconfig.base.json`, the root `vitest.config.ts`), the release scripts and host scripts under
`scripts/`, the deployment files (`Dockerfile`, `docker-compose*.yml`, `docker-entrypoint.sh`,
`deploy/`), `tests/docs/`, the docs and `openspec/`. The root `package.json` passes each application
command to its package with `pnpm --filter`.

## Processes and layers

```
 Browser
   |
   |  HTTPS
   v
 Caddy  (optional, profile with-proxy)
   |
   v
 +---------------------------------------------+      +--------------------------------+
 | app  (Next.js, apps/web)                    |      | worker  (apps/worker/worker.ts)|
 |                                             |      |                                |
 |  proxy.ts           routing state, headers  |      |  from apps/web:                |
 |  app/(auth) (dashboard) (editor) (public)   |      |    lib/jobs/worker.ts          |
 |  app/api/**         routes                  |      |    features/*/jobs.ts          |
 |  features/*         mutations, queries      |      |    features/*/pdfRenderJob.ts  |
 |  features/*/services   pure rules           |      |                                |
 +---------------------------------------------+      +--------------------------------+
      |             |               |                        |        |        |
      v             v               v                        v        v        v
  database       redis           storage                  database  redis   storage
  (Postgres)     (queue, rate    (S3-compatible)
                  limits, job stats)
```

`docker-compose.yml` defines these six services: `database`, `redis`, `storage`, `app`, `worker` and
`caddy` (profile `with-proxy`). The app and worker images share one codebase; the worker image
starts `apps/worker/dist/worker.js` (`Dockerfile`) and is the only one that ships Chromium. The
route groups are `(auth)` (login, register, setup, invite, password pages), `(dashboard)`,
`(editor)` (templates) and `(public)` (the `/i`, `/p`, `/c` and `/s` token routes), under
`apps/web/app/`.

## Module boundaries

A feature is a closed module under `apps/web/features/<feature>/`. Another feature, a route or a job
imports it only through four doors: `index`, `server`, `systemWrites` and `services`
(`featureBoundaryRule` in `eslint.config.mjs`; the shape and the reasons are in
`.agents/rules/architecture.md`). `systemWrites` exists because `server` re-exports `"use server"`
actions that cannot load in the worker. `import/no-cycle` runs in oxlint (`.oxlintrc.json`).

The worker is its own package, `apps/worker`, and reaches the job handlers, the database and
`apps/web/lib/` through the web package: it depends on `@remit/web`, whose `exports` map in
`apps/web/package.json` names the modules the worker loads, plus `./lib/jobs`, which only
`apps/worker/core/__tests__/jobCatalog.integration.test.ts` imports. `pnpm typecheck` rejects an
`@remit/web/...` path the map does not name. It cannot reject `@/`, which
`apps/worker/tsconfig.json` maps for the web modules it checks, or a relative path into `apps/web`,
which needs no mapping, so ESLint rejects `@/` and a `../`-prefixed path into `apps/web`
(`webDeepImportPattern` in `eslint.config.mjs`) in static imports, re-exports and `import()` alike;
other relative spellings of such a path are not caught. Its tsup bundle inlines the `@remit/web`
modules, and `apps/worker/resolveWebDependencies.ts` resolves their dependencies from the web
package at run time. Known limit: this is one application depending on another, not on a shared
package. The `job-queues` change, the `command-layer-outbox` change, or a change that creates
`packages/db` removes the edge by moving what the worker needs out of `apps/web`. Drizzle is called
from `queries.ts`, `mutations.ts`, `public*.ts`, `jobs.ts`, `systemWrites.ts`, `apps/web/proxy.ts`
and `apps/web/scripts/`, and never from `services/`.

## Request flow

Every request meets `apps/web/proxy.ts` first. It derives routing state from the database and the
session and from nothing else; routing state is never stored in a cookie
(`.agents/rules/security.md`). The order is the state machine:

```
public token route (/i /p /c /s)   rate limit, headers, then the route
/invite/...                        its own rate limit, ahead of the user and session guards
no user row                        -> /register
no session                         -> /login
setup incomplete                   -> /setup  (business name set AND TOTP enrolled)
session without a membership       -> session cleared, /login
users.mustChangePassword           -> /change-password
otherwise                          -> the requested route
```

`/api/health`, `/api/mcp`, `/api/v1/`, `/api/auth/` and `/api/webhooks/` pass straight through; each
authenticates its own caller. `/api/metrics` is rewritten to `/api/metrics/scrape` only for an
admitted scrape (`apps/web/lib/metrics/admission.ts`). The matcher leaves out `api/upload/` and
`api/storage/`, which set their own headers (`apps/web/proxy.ts`).

A page reads through `queries.ts`, gated by `requireRole` in `apps/web/lib/auth/session.ts`, which
answers an insufficient role with `notFound()`. A write is a server action in `mutations.ts`
(`.agents/rules/actions.md`): validate, check the session and role, call the pure rule, write, then
write the audit entry, emit the domain event and revalidate. It returns `{ data }` or `{ error }`
and never throws to the client. API routes exist only for the anonymous token routes, webhooks,
health and metrics and justified public surfaces such as uploads, downloads and the public API
(`.agents/rules/routes.md`).

The event bus (`apps/web/lib/events/bus.ts`, names and payloads in `apps/web/lib/events/types.ts`)
is in-process. `emit` awaits every handler and catches nothing, so a handler catches and logs its
own failures (`.agents/rules/events.md`). Its subscribers are
`apps/web/features/activityLog/events/`, which turns events into `activity_logs` rows, and
`apps/web/features/webhooks/events.ts`, which queues outbound deliveries. They are imported by
`apps/web/instrumentation.ts` for the app and by `apps/worker/core/loadWorkerFeatureModules.ts` for
the worker. The audit log is not on the bus: `writeAudit` (`apps/web/lib/audit/index.ts`) runs
inline in the action, because an entry a handler could drop is not an audit entry.

## Job flow

A server action or a sweep calls `enqueueJob` (`apps/web/lib/jobs/enqueue.ts`); the names and
payloads are the typed catalog in `apps/web/lib/jobs/types.ts`. An enqueue that cannot reach Redis
is logged, not thrown, so a queued side effect never fails the action; a malformed `jobId` does
throw (`apps/web/lib/jobs/jobId.ts`). The worker (`apps/web/lib/jobs/worker.ts`) runs one job at a
time, five attempts with exponential backoff (`apps/web/lib/jobs/queue.ts`). A job name has exactly
one handler, registered at module load by `apps/web/features/*/jobs.ts`
(`apps/web/lib/jobs/registry.ts`), and the worker loads those modules through
`apps/worker/core/loadWorkerFeatureModules.ts`;
`apps/worker/core/__tests__/jobCatalog.integration.test.ts` fails when a name has no handler or a
handler has no name. Money-affecting handlers are idempotent in the database, not by job id.

Six sweeps are scheduled in UTC from `apps/web/lib/jobs/schedules.ts`: backup, recurring invoices,
overdue detection, reminders, retention purge and the hourly storage deletion sweep. A schedule that
is dropped in code is removed from Redis at the next worker boot. The backup pattern is fixed;
whether tonight is a backup night is decided from `settings.backup_cadence` in
`apps/web/features/backups/jobs.ts`. PDF rendering (`apps/web/features/*/pdfRenderJob.ts`) and data
and report exports run in the worker. A document with no template of its type renders from the
built-in layout (`apps/web/features/invoices/pdfRenderJob.ts`).

## Data model principles

- Table shapes, constraints and foreign-key actions are `apps/web/database/schema/` and
  `apps/web/drizzle/migrations/`. Money is integer minor units (`.agents/rules/money-and-dates.md`).
- Invoice states are `draft`, `sent` and `paid` in `apps/web/database/schema/enums.ts`. `overdue`
  and `partially_paid` are computed, never stored, by `deriveInvoiceStatusView` in
  `apps/web/features/invoices/services/invoiceStatusView.ts`, and a proposal is expired when
  `isProposalExpired` in `apps/web/features/proposals/services/proposalNumber.ts` says so.
- What a client owes is one figure, `getInvoiceOutstandingCents`, and an invoice is settled exactly
  when it reaches zero on a positive total
  (`apps/web/features/payments/services/paymentSettlement.ts`). A credit note issued, withdrawn or
  restored re-decides settlement under the invoice lock (`resettleInvoiceWrite` in
  `apps/web/features/payments/paymentWrites.ts`).
- An invoice number is permanent: `invoices.number` is unique across soft-deleted rows
  (`apps/web/database/schema/invoices.ts`) and the counter only moves forward (`claimInvoiceNumber`
  in `apps/web/features/invoices/invoiceWrites.ts`).
- A conversion is recorded once, on the produced document (`invoices.proposal_id`,
  `contracts.proposal_id`); the proposal has no pointer back
  (`apps/web/database/schema/proposals.ts`). Acceptance stamps `proposals.locked_at`
  (`apps/web/features/proposals/publicResponse.ts`). A proposal moves forward only and only a draft
  is editable, so a correction is a new proposal
  (`apps/web/features/proposals/services/canTransitionProposalStatus.ts`).
- `time_entries.invoiced_in_id` and `expenses.invoiced_in_id` are the canonical billed link.
  `apps/web/features/invoices/billing.ts` stamps them in the invoice's own transaction with an
  `IS NULL` predicate whose row count must match the plan, so nothing is billed twice; the retainer
  branch of `apps/web/features/recurringInvoices/jobs.ts` stamps a project's unbilled time the same
  way. `line_items.source_time_entry_id` and `source_expense_id` are per-line provenance, set only
  for a line drawn from exactly one source row; they neither mirror nor derive from the billed link
  (`apps/web/features/invoices/services/billableConversion.ts`).
- `audit_logs` and `contract_signatures` are insert-only, enforced by triggers in
  `apps/web/drizzle/migrations/0001_insert_only_guards.sql` (the signature row has one sanctioned
  update, its signed PDF).
- A project and a client on one document must agree, enforced by the composite key in
  `apps/web/drizzle/migrations/0002_document_parent_agreement.sql`. Its `ON UPDATE RESTRICT` also
  refuses re-parenting a project to another client while a proposal, invoice, expense, contract or
  recurring invoice names it; soft delete and the rest of the table conventions are
  `.agents/rules/database.md`.
- Deleting from the application is a soft delete that stamps one row and never cascades. The owner
  restores from the trash (`apps/web/features/trash/services/restoreEligibility.ts`) and purges by
  retention windows that are null, meaning never purge, by default
  (`apps/web/features/trash/services/purgeSchedule.ts`). Erasing a client is a separate hard delete
  (`apps/web/features/clients/forget.ts`) that ignores every retention window and is refused while
  the client has a countersigned contract, because the delete would cascade into an insert-only
  signature. Both walk the delete order in `apps/web/scripts/core/domainData/inventory.ts`.
- A data export is an allowlist of table and column enforced when each row is serialised
  (`projectExportRow` in `apps/web/features/dataExport/services/exportManifest.ts`);
  `apps/web/features/dataExport/__tests__/manifest.integration.test.ts` fails when a new column is
  neither included nor excluded. Bearer tokens, provider secrets and the Better Auth tables are
  excluded; `clients.notes`, an encrypted column, travels in plaintext as the owner's own record.

## Security model and roles

**Roles.** Three roles, fixed in code: `owner`, `accountant`, `assistant`
(`apps/web/lib/auth/index.ts`). Exactly one owner per organization (`uq_member_owner_per_org` in
`apps/web/database/schema/organizations.ts`) and one organization per instance. The policy is spread
over the gates in the eight `apps/web/features/*/mutationContext.ts` files and in the
`getCurrentRole` comparisons of the other `mutations.ts` files; this is the one statement of it:

| Role         | Reads               | Writes                                                              |
| ------------ | ------------------- | ------------------------------------------------------------------- |
| `owner`      | everything          | everything, including send, delete, public links, settings and team |
| `accountant` | every domain entity | records payments, writes credit notes, marks invoices paid, exports |
| `assistant`  | every domain entity | creates and edits records: clients, projects, documents, time       |

Send, delete, terminate, rotate or revoke a public link, and every settings page except the user's
own profile, security and appearance, are owner-only. A full data export and the team are
owner-only; an accountant may export a report or the expenses
(`apps/web/features/reports/mutationContext.ts`). `apps/web/features/api/services/apiAccess.ts`
restates what each role reads for API tokens, so narrowing a role is one edit there. A role that has
no membership resolves to `null`, which every gate refuses (`apps/web/lib/auth/session.ts`).

Routes and pages gate with `requireRole`; server actions use `getCurrentRole` and return
`{ error }`. A hidden link is never the authorization: each owner-only page repeats its own check.

**Authentication.** Better Auth owns users, sessions, TOTP and memberships; the handler is
`apps/web/app/api/auth/[...all]/route.ts`, which writes the audit entries for sign-in, sign-up,
password and TOTP routes and the rate-limit trips. TOTP enrollment is part of `setupComplete` in
`apps/web/proxy.ts`, so every role enrolls, and it can never be turned off
(`.agents/rules/security.md`).

**Secrets.** `encryptedColumn` values are AES-256-GCM (`apps/web/lib/encryption/aes.ts`).

**Public tokens.** Invoice, proposal, contract and portal links carry a bearer token of 32 random
bytes minted only by `mintPublicToken` and compared in constant time with `matchesPublicToken`
(`apps/web/lib/publicToken.ts`). Public pages send `X-Robots-Tag: noindex`. Every response carries a
CSP and a framing denial (`apps/web/lib/securityHeaders.ts`, `applySecurityHeaders`), token routes
included: each hosts a control a framing page could steer a client into (paying, accepting,
signing), and nothing embeds them.

**Files.** A browser never talks to the object store. Uploads stream through
`apps/web/app/api/upload/[type]`; the public bucket is served by `apps/web/app/api/storage/[...key]`
and the private `documents` bucket only by `apps/web/app/api/attachments/[id]` and
`apps/web/app/api/documents/[type]/[id]` after a session check (the token routes render a document
as a page and do not serve that bucket); the storage route cannot read any other bucket
(`apps/web/lib/storage/bucketNames.ts`, `apps/web/app/api/storage/[...key]/route.ts`). Data exports
and report PDFs live in a third `exports` bucket reached through `apps/web/app/api/exports/[id]` and
`apps/web/app/api/report-exports/[id]`.

**Rate limits.** `apps/web/lib/rateLimit/` counts in Redis and falls back to a per-process counter
while Redis is unreachable. Better Auth counts its own limits through it
(`apps/web/lib/auth/index.ts`), and `apps/web/proxy.ts` limits the token routes and `/invite/`.

**Assistants.** `/api/mcp` serves the public API's resources through the same
`authenticateApiRequest` and response schemas as `/api/v1/` (`apps/web/features/mcp/`,
`apps/web/features/api/responseSchemas.ts`): read-only, off until the owner enables it, and refused
with a 404 until then (`apps/web/features/mcp/handleMcpRequest.ts`).

## Locale

Two locales are independent. The UI language comes from `apps/web/lib/i18n/`
(`apps/web/lib/i18n/server.ts` translates on the server). The document locale, used for number and
date formats in PDFs and emails, is `settings.default_locale`
(`apps/web/database/schema/settings.ts`), overridden per client by `clients.locale`
(`apps/web/database/schema/clients.ts`). Activity rows store a message key and its arguments, not
rendered text, so the feed follows the viewer's language
(`apps/web/features/activityLog/__tests__/localeIndependence.test.ts`).

## What leaves the instance

Nothing leaves unless the operator configures it (`.agents/rules/security.md`). The outbound traffic
is: the email, payment and object-store providers the operator supplies; webhook endpoints an owner
registers, which receive record ids and a few scalar facts
(`apps/web/features/webhooks/services/payload.ts`) through `safePost`
(`apps/web/features/webhooks/safePost.ts`), which refuses private addresses unless allowed; and,
only when `SENTRY_DSN` is set, error reports.

An error report is built only by `buildErrorEvent` in `apps/web/lib/errorTracking/errorEvent.ts`: it
carries no message, request path, id or business data, and it drops the whole event rather than a
field when a value is outside its vocabulary
(`apps/web/lib/errorTracking/__tests__/errorEvent.test.ts`). Reports leave from
`apps/web/instrumentation.ts`, `apps/web/lib/jobs/worker.ts`, `apps/worker/worker.ts` and
`apps/worker/core/crash.ts` and nowhere else; features cannot import the reporter
(`featureBoundaryRule` in `eslint.config.mjs`).

`GET /api/metrics` is pull only, behind `REMIT_METRICS_TOKEN`; an unadmitted request is
indistinguishable from an unknown path (`apps/web/lib/metrics/admission.ts`). It exposes process
gauges, queue depths and the scheduled sweeps' outcomes, every label from a closed vocabulary, and
no domain row counts (`apps/web/lib/metrics/collectMetrics.ts`,
`apps/web/lib/metrics/__tests__/handleMetricsRequest.test.ts`); the scrape configuration is
`docs/operations/METRICS.md`.

The public API and the MCP server answer a holder of an API token with records of five resources:
clients, projects, invoices, time entries and expenses
(`apps/web/features/api/services/apiAccess.ts`). Every result is parsed through a schema that names
each field, so client notes, public tokens and storage keys are not returned
(`apps/web/features/api/responseSchemas.ts`). An answer to an assistant leaves the operator's
control once returned.
