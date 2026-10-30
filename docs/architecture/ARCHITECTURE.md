# Remit architecture map

## Scope

This is the map of how Remit's parts fit together and the principle behind each. Every section names
the file that verifies it; when the two disagree, the file is right and this map is the defect.
Conventions for writing code are in `AGENTS.md` and `.agents/rules/`, table and column shapes in
`database/schema/`, `remit:*` commands in `scripts/README.md`, and operator procedures in
`docs/operations/` and `docs/deploy/`.

## What Remit is and is not

Remit is a self-hostable business management app for independent freelancers, covering the money
lifecycle from lead to payment (`AGENTS.md`, `README.md`). Every stage is optional: an invoice's
client and project keys are nullable (`database/schema/invoices.ts`).

The people at a client are sub-records of that client (`database/schema/clientContacts.ts`), never a
top-level entity: no `features/contacts/` exists and no other table references a contact.

Multi-user is three fixed roles inside one organization (`lib/auth/index.ts`), not a team tool.

## Standing principles

- One instance is one business. No table carries a `tenantId` and no query is scoped by tenant
  (`database/schema/`, `AGENTS.md` Hard rules). Operating Remit for somebody else means one isolated
  instance per customer. `REMIT_HOSTED_MODE` (`lib/config/envSchema.ts`) is read in four files, all
  for the backup destination: on a hosted instance the destination is the operator's, so
  `features/backups/jobs.ts` skips the scheduled backup and `features/settings/backup/mutations.ts`
  refuses writes. Nothing else branches on it.
- Email and payment providers are optional and configured in settings, not required to boot
  (`database/schema/settings.ts`). Postgres, Redis and an S3-compatible object store are required:
  `lib/config/envSchema.ts` exits the process without them.
- Secrets are encrypted at rest with `encryptedColumn(` (`database/schema/helpers.ts`) under
  `REMIT_ENCRYPTION_KEY`; key custody is in `docs/operations/INSTALL.md`.
- Business rules are pure functions in `features/<feature>/services/` (`pureServicesRule` in
  `eslint.config.mjs`).
- Self-hosting operations are product work: backup, restore, reset, rotation and upgrade are
  `remit:*` commands and runbooks (`scripts/README.md`, `docs/operations/BACKUP.md`,
  `docs/operations/UPGRADE.md`).

## Processes and layers

```
 Browser
   |
   |  HTTPS
   v
 Caddy  (optional, profile with-proxy)
   |
   v
 +---------------------------------------------+      +-----------------------------+
 | app  (Next.js)                              |      | worker  (scripts/worker.ts) |
 |                                             |      |                             |
 |  proxy.ts           routing state, headers  |      |  lib/jobs/worker.ts         |
 |  app/(auth) (dashboard) (editor) (public)   |      |  features/*/jobs.ts         |
 |  app/api/**         routes                  |      |  features/*/pdfRenderJob.ts |
 |  features/*         mutations, queries      |      |                             |
 |  features/*/services   pure rules           |      |                             |
 +---------------------------------------------+      +-----------------------------+
      |             |               |                        |        |        |
      v             v               v                        v        v        v
  database       redis           storage                  database  redis   storage
  (Postgres)     (queue, rate    (S3-compatible)
                  limits, job stats)
```

`docker-compose.yml` defines these six services: `database`, `redis`, `storage`, `app`, `worker` and
`caddy` (profile `with-proxy`). The app and worker images share one codebase; the worker image
starts `scripts/dist/worker.js` (`Dockerfile`) and is the only one that ships Chromium. The route
groups are `(auth)` (login, register, setup, invite, password pages), `(dashboard)`, `(editor)`
(templates) and `(public)` (the `/i`, `/p`, `/c` and `/s` token routes), under `app/`.

## Module boundaries

A feature is a closed module under `features/<feature>/`. Another feature, a route or a job imports
it only through four doors: `index`, `server`, `systemWrites` and `services` (`featureBoundaryRule`
in `eslint.config.mjs`; the shape and the reasons are in `.agents/rules/architecture.md`).
`systemWrites` exists because `server` re-exports `"use server"` actions that cannot load in the
worker. `import/no-cycle` runs in oxlint (`.oxlintrc.json`). Drizzle is called from `queries.ts`,
`mutations.ts`, `public*.ts`, `jobs.ts`, `systemWrites.ts`, `proxy.ts` and `scripts/`, and never
from `services/`.

## Request flow

Every request meets `proxy.ts` first. It derives routing state from the database and the session and
from nothing else; routing state is never stored in a cookie (`.agents/rules/security.md`). The
order is the state machine:

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
admitted scrape (`lib/metrics/admission.ts`). The matcher leaves out `api/upload/` and
`api/storage/`, which set their own headers (`proxy.ts`).

A page reads through `queries.ts`, gated by `requireRole` in `lib/auth/session.ts`, which answers an
insufficient role with `notFound()`. A write is a server action in `mutations.ts`
(`.agents/rules/actions.md`): validate, check the session and role, call the pure rule, write, then
write the audit entry, emit the domain event and revalidate. It returns `{ data }` or `{ error }`
and never throws to the client. API routes exist only for the anonymous token routes, webhooks,
health and metrics and justified public surfaces such as uploads, downloads and the public API
(`.agents/rules/routes.md`).

The event bus (`lib/events/bus.ts`, names and payloads in `lib/events/types.ts`) is in-process.
`emit` awaits every handler and catches nothing, so a handler catches and logs its own failures
(`.agents/rules/events.md`). Its subscribers are `features/activityLog/events/`, which turns events
into `activity_logs` rows, and `features/webhooks/events.ts`, which queues outbound deliveries. They
are imported by `instrumentation.ts` for the app and by
`scripts/core/worker/loadWorkerFeatureModules.ts` for the worker. The audit log is not on the bus:
`writeAudit` (`lib/audit/index.ts`) runs inline in the action, because an entry a handler could drop
is not an audit entry.

## Job flow

A server action or a sweep calls `enqueueJob` (`lib/jobs/enqueue.ts`); the names and payloads are
the typed catalog in `lib/jobs/types.ts`. An enqueue that cannot reach Redis is logged, not thrown,
so a queued side effect never fails the action; a malformed `jobId` does throw
(`lib/jobs/jobId.ts`). The worker (`lib/jobs/worker.ts`) runs one job at a time, five attempts with
exponential backoff (`lib/jobs/queue.ts`). A job name has exactly one handler, registered at module
load by `features/*/jobs.ts` (`lib/jobs/registry.ts`), and the worker loads those modules through
`scripts/core/worker/loadWorkerFeatureModules.ts`;
`lib/jobs/__tests__/jobCatalog.integration.test.ts` fails when a name has no handler or a handler
has no name. Money-affecting handlers are idempotent in the database, not by job id.

Six sweeps are scheduled in UTC from `lib/jobs/schedules.ts`: backup, recurring invoices, overdue
detection, reminders, retention purge and the hourly storage deletion sweep. A schedule that is
dropped in code is removed from Redis at the next worker boot. The backup pattern is fixed; whether
tonight is a backup night is decided from `settings.backup_cadence` in `features/backups/jobs.ts`.
PDF rendering (`features/*/pdfRenderJob.ts`) and data and report exports run in the worker. A
document with no template of its type renders from the built-in layout
(`features/invoices/pdfRenderJob.ts`).

## Data model principles

- Table shapes, constraints and foreign-key actions are `database/schema/` and
  `drizzle/migrations/`. Money is integer minor units (`.agents/rules/money-and-dates.md`).
- Invoice states are `draft`, `sent` and `paid` in `database/schema/enums.ts`. `overdue` and
  `partially_paid` are computed, never stored, by `deriveInvoiceStatusView` in
  `features/invoices/services/invoiceStatusView.ts`, and a proposal is expired when
  `isProposalExpired` in `features/proposals/services/proposalNumber.ts` says so.
- What a client owes is one figure, `getInvoiceOutstandingCents`, and an invoice is settled exactly
  when it reaches zero (`features/payments/services/paymentSettlement.ts`).
- A conversion is recorded once, on the produced document (`invoices.proposal_id`,
  `contracts.proposal_id`); the proposal has no pointer back (`database/schema/proposals.ts`).
  Acceptance stamps `proposals.locked_at` (`features/proposals/publicResponse.ts`).
- `time_entries.invoiced_in_id` and `expenses.invoiced_in_id` are the canonical billed link.
  `features/invoices/billing.ts` stamps them in the invoice's own transaction with an `IS NULL`
  predicate whose row count must match the plan, so nothing is billed twice.
  `line_items.source_time_entry_id` and `source_expense_id` are per-line provenance, set only for a
  line drawn from exactly one source row; they neither mirror nor derive from the billed link
  (`features/invoices/services/billableConversion.ts`).
- `audit_logs` and `contract_signatures` are insert-only, enforced by triggers in
  `drizzle/migrations/0001_insert_only_guards.sql` (the signature row has one sanctioned update, its
  signed PDF).
- A project and a client on one document must agree, enforced by the composite key in
  `drizzle/migrations/0002_document_parent_agreement.sql`; soft delete and the rest of the table
  conventions are `.agents/rules/database.md`.
- Deleting from the application is a soft delete that stamps one row and never cascades. The owner
  restores from the trash (`features/trash/services/restoreEligibility.ts`) and purges by retention
  windows that are null, meaning never purge, by default
  (`features/trash/services/purgeSchedule.ts`). Erasing a client is a separate hard delete
  (`features/clients/forget.ts`) that ignores every retention window and is refused while the client
  has a countersigned contract, because the delete would cascade into an insert-only signature. Both
  walk the delete order in `scripts/core/domainData/inventory.ts`.
- A data export is an allowlist of table and column enforced at the select
  (`features/dataExport/services/exportManifest.ts`); a test fails when a new column is neither
  included nor excluded. Bearer tokens, every encrypted column and the Better Auth tables are
  excluded.

## Security model and roles

**Roles.** Three roles, fixed in code: `owner`, `accountant`, `assistant` (`lib/auth/index.ts`).
Exactly one owner per organization (`uq_member_owner_per_org` in `database/schema/organizations.ts`)
and one organization per instance. The policy is spread over the gates in the eight
`features/*/mutationContext.ts` files and in the `getCurrentRole` comparisons of the other
`mutations.ts` files; this is the one statement of it:

| Role         | Reads               | Writes                                                              |
| ------------ | ------------------- | ------------------------------------------------------------------- |
| `owner`      | everything          | everything, including send, delete, public links, settings and team |
| `accountant` | every domain entity | records payments, writes credit notes, marks invoices paid, exports |
| `assistant`  | every domain entity | creates and edits records: clients, projects, documents, time       |

Send, delete, terminate, rotate or revoke a public link, and every settings page except the user's
own profile, security and appearance, are owner-only. A full data export and the team are
owner-only; an accountant may export a report or the expenses
(`features/reports/mutationContext.ts`). `features/api/services/apiAccess.ts` restates what each
role reads for API tokens, so narrowing a role is one edit there. A role that has no membership
resolves to `null`, which every gate refuses (`lib/auth/session.ts`).

Routes and pages gate with `requireRole`; server actions use `getCurrentRole` and return
`{ error }`. A hidden link is never the authorization: each owner-only page repeats its own check.

**Authentication.** Better Auth owns users, sessions, TOTP and memberships; the handler is
`app/api/auth/[...all]/route.ts`, which writes the audit entries for sign-in, sign-up, password and
TOTP routes and the rate-limit trips. TOTP enrollment is part of `setupComplete` in `proxy.ts`.

**Public tokens.** Invoice, proposal, contract and portal links carry a bearer token minted only by
`mintPublicToken` and compared with `matchesPublicToken` (`lib/publicToken.ts`). Public pages send
`X-Robots-Tag: noindex` and every response carries a framing denial (`lib/securityHeaders.ts`,
`applySecurityHeaders`).

**Files.** A browser never talks to the object store. Uploads stream through
`app/api/upload/[type]`; the public bucket is served by `app/api/storage/[...key]` and the private
`documents` bucket only by `app/api/attachments/[id]` after a session check; the storage route
cannot read any other bucket (`lib/storage/bucketNames.ts`, `app/api/storage/[...key]/route.ts`).
Data exports and report PDFs live in a third `exports` bucket reached through `app/api/exports/[id]`
and `app/api/report-exports/[id]`.

**Rate limits.** `lib/rateLimit/` counts in Redis and falls back to a per-process counter while
Redis is unreachable. Better Auth counts its own limits through it (`lib/auth/index.ts`), and
`proxy.ts` limits the token routes and `/invite/`.

**Assistants.** `/api/mcp` serves the public API's resources through the same
`authenticateApiRequest` and response schemas as `/api/v1/` (`features/mcp/`,
`features/api/responseSchemas.ts`): read-only, off until the owner enables it, and refused with a
404 until then (`features/mcp/handleMcpRequest.ts`).

## Locale

Two locales are independent. The UI language comes from `lib/i18n/` (`lib/i18n/server.ts` translates
on the server). The document locale, used for number and date formats in PDFs and emails, is
`settings.default_locale` (`database/schema/settings.ts`), overridden per client by `clients.locale`
(`database/schema/clients.ts`). Activity rows store a message key and its arguments, not rendered
text, so the feed follows the viewer's language
(`features/activityLog/__tests__/localeIndependence.test.ts`).

## What leaves the instance

Nothing leaves unless the operator configures it (`.agents/rules/security.md`). The outbound traffic
is: the email, payment and object-store providers the operator supplies; webhook endpoints an owner
registers, which receive record ids and a few scalar facts (`features/webhooks/services/payload.ts`)
through `safePost` (`features/webhooks/safePost.ts`), which refuses private addresses unless
allowed; and, only when `SENTRY_DSN` is set, error reports.

An error report is built only by `buildErrorEvent` in `lib/errorTracking/errorEvent.ts`: it carries
no message, request path, id or business data, and it drops the whole event rather than a field when
a value is outside its vocabulary (`lib/errorTracking/__tests__/errorEvent.test.ts`). Reports leave
from `instrumentation.ts`, `lib/jobs/worker.ts` and `scripts/worker.ts` and nowhere else; features
cannot import the reporter (`featureBoundaryRule` in `eslint.config.mjs`).

`GET /api/metrics` is pull only, behind `REMIT_METRICS_TOKEN`; an unadmitted request is
indistinguishable from an unknown path (`lib/metrics/admission.ts`). It exposes process gauges,
queue depths and the scheduled sweeps' outcomes, every label from a closed vocabulary, and no domain
row counts (`lib/metrics/collectMetrics.ts`, `lib/metrics/__tests__/handleMetricsRequest.test.ts`);
the scrape configuration is `docs/operations/METRICS.md`.

The public API and the MCP server answer a holder of an API token with records of five resources:
clients, projects, invoices, time entries and expenses (`features/api/services/apiAccess.ts`). Every
result is parsed through a schema that names each field, so client notes, public tokens and storage
keys are not returned (`features/api/responseSchemas.ts`). An answer to an assistant leaves the
operator's control once returned.
