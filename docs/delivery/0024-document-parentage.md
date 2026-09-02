# DR-0024: Document parentage integrity

- **Status:** Shipped
- **Date:** 2026-08-20
- **Verdict:** Complete
- **Decisions:** ADR-0026
- **Supersedes:** —
- **Reconstructed:** yes

## What

Every financial document hangs off an optional project and a client that must agree with it,
enforced by composite foreign keys and check constraints rather than by the call sites.

## Why

Two integrity defects, both representable in the database rather than merely discouraged. A proposal
required a project, which contradicted the architecture's own statement that any subset of the
workflow is valid and made the earliest document demand the later entity exist first. And the two
parent columns could disagree: re-parenting a project rewrote its client without consulting the
invoices, expenses, contracts and schedules that had copied the old one, leaving every financial
record under it naming the previous client.

## Scope

Included: `proposals` adopting the `contracts` shape with a nullable project and a nullable client;
composite foreign keys on all five dual-parent tables; the `chk_<table>_project_requires_client`
checks; the unique index on `projects (id, client_id)` the composite key requires; and a translated
refusal at the action boundary when a project's client is changed with dependents.

Excluded: a "not both null" check on `expenses`. An expense with neither parent is legitimate,
because a bank fee belongs to nobody. Also excluded: deriving the client by joining through the
project and storing it once — the denormalisation exists precisely so a financial record survives
its project being deleted.

## How

The constraint is declarative rather than a trigger. ADR-0026 records why: a trigger is procedural,
runs per row, and can be disabled or bypassed by a session that turns triggers off, while a
declarative constraint is checked by the planner and cannot be switched off.

None of the five tables carries a single-column `project_id` foreign key, and the absence is
load-bearing rather than an oversight: with both keys present, deleting a project is rejected
outright instead of nulling the column.

A composite foreign key with one null column is not checked at all by Postgres under MATCH SIMPLE,
so each table additionally carries a check refusing a row that names a project and no client.
Without it a row could skip the agreement rule entirely.

`ON UPDATE RESTRICT` produces a raw foreign-key error, which must never reach a user, so
`updateProject` refuses a client change with a translated message when dependents exist. The
database is the floor beneath that message rather than a replacement for it.

## Evidence

- `drizzle/migrations/0002_document_parent_agreement.sql`
- `database/schema/proposals.ts`, `contracts.ts`, `invoices.ts`, `expenses.ts`,
  `recurringInvoices.ts`, `projects.ts` — each carrying the comment naming the migration and
  constraint, because the relationship is not visible in the Drizzle schema alone
- `features/projects/mutations.ts` — `updateProject`'s refusal
- `features/expenses/mutations.ts` — `resolveExpenseScope`
- `features/proposals/` — client-level proposals and parent agreement selection
- `docs/architecture/adr/0026-document-parentage.md`

## Verification

Integration tests cover each of the five tables against a real Postgres for every behaviour the ADR
names: a row naming a project and that project's client is accepted; a row naming a project and a
different client is rejected by the foreign key; a client-only row is accepted; a row naming a
project and no client is rejected by the check; changing a project's client with dependents is
refused; changing anything else about the project succeeds; and a hard project delete nulls the
project while the client survives. `features/proposals/__tests__/publicResponse.integration.test.ts`
and the `documentData.integration.test.ts` files in three features cover the parent agreement
through the document paths.

Not covered: a backfill of an already-populated database. The baseline creates the columns and
checks together on an empty database, so the backfill path the ADR describes has never run.

## Known gaps

A project's client is effectively immutable once any financial record exists. Correcting a genuine
mistake means deleting or re-issuing the documents; no supported "move this project" operation
exists. The relationship is not visible in the Drizzle schema alone and a reader must open the
migration.
