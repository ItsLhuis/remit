# ADR-0026: Document parentage — optional project, agreeing client, composite key

- **Status:** Accepted
- **Date:** 2026-08-20

## Context

Remit's workflow is Lead → Client → Project → Proposal/Contract → Invoice, and
[Architecture: What Remit is](../ARCHITECTURE.md#1-what-remit-is) states that any subset of it is
valid and that the system enforces no required progression. The schema disagreed with that statement
in two ways at once.

**A proposal required a project.** `proposals.project_id` was `NOT NULL` while `contracts`,
`invoices`, and `expenses` all carried a nullable `project_id` beside a nullable `client_id` and
supported a client-level document end to end, and `recurring_invoices` hung off a client with an
optional project. The proposal is chronologically the earliest document a freelancer produces, and
it was the only one that demanded the later entity exist first. The `NOT NULL` also forced
`ON DELETE CASCADE`: deleting a project destroyed the accepted proposal that a signed contract and
an issued invoice both pointed at, while every sibling table used `set null` precisely so financial
records survive their project.

**The two parents could disagree, and one shipped path made them disagree.** `invoices`, `expenses`,
`contracts`, and `recurring_invoices` each carry both columns, and `client_id` is a deliberate
denormalisation — a financial record must survive its project. Nothing asserted that `client_id` was
the project's own client. `chk_invoices_parent` and `chk_contracts_parent` only asserted "not both
null". Agreement lived in application code at three of the write sites and nowhere at the fourth:
`features/projects/mutations.ts`'s `updateProject` accepted a new `clientId` for an existing project
and wrote it without consulting the invoices, expenses, contracts, and recurring schedules that had
copied the old one. Re-parenting a project left every financial record under it naming the previous
client, and the client filter and the project filter then disagreed about who owed the money.

Both are integrity defects rather than missing features: the corrupt states were representable, and
the only thing standing between the database and one was five call sites remembering.

## Decision

**Every financial document hangs off an optional project and a client that is required whenever a
project is present, and the pair must agree.** The rule applies to all five dual-parent tables —
`proposals`, `contracts`, `invoices`, `expenses`, `recurring_invoices` — and is enforced by the
database, not by the call sites.

**`proposals` adopts the `contracts` shape.** `project_id` becomes nullable with
`ON DELETE SET NULL`, a nullable `client_id` is added with `ON DELETE SET NULL`, and
`chk_proposals_parent` (`project_id IS NOT NULL OR client_id IS NOT NULL`) is worded identically to
`chk_contracts_parent`. Any migration adding `client_id` to a populated database backfills it from
the project before either check exists; the shipped baseline creates the column and its checks
together, on an empty database. This is parity work, not a new document type: numbering, the
mint-at-draft/withhold-until-issued public token, the `locked_at` immutability-after-acceptance
rule, the OTP flow, and the ADR-0017 line-item parent set are all unchanged, and accepting a
client-level proposal does exactly what accepting a project-level one does — it does not create a
project.

**The pair is enforced by a composite foreign key.** `projects` gains a unique index on
`(id, client_id)` — not a domain rule of its own, since `id` is already unique, but the referenced
column list Postgres requires. None of the five tables carries a single-column `project_id` foreign
key; each carries
`FOREIGN KEY (project_id, client_id) REFERENCES projects (id, client_id) ON DELETE SET NULL (project_id) ON UPDATE RESTRICT`
instead, added by `0002_document_parent_agreement.sql` because Drizzle cannot express either clause.
The absence of the single-column key is load-bearing, not an oversight: with both present, a project
delete is rejected outright instead of nulling the column.

**A check closes the MATCH SIMPLE hole.** A composite foreign key with one null column is not
checked at all by Postgres, so `chk_<table>_project_requires_client`
(`project_id IS NULL OR client_id IS NOT NULL`) is added to each of the five tables. Without it a
row could name a project, name no client, and skip the agreement rule entirely.

**The behaviours this produces**, verified against Postgres 16 and covered by integration tests for
each of the five tables: a row naming a project and that project's client is accepted; a row naming
a project and a different client is rejected by the foreign key; a client-only row is accepted, so
the ad-hoc client document still works; a row naming a project and no client is rejected by the
check; changing `projects.client_id` while dependent rows exist is refused; changing anything else
about the project succeeds; and a hard project delete nulls `project_id` while `client_id` survives
intact.

**The user-facing half.** `ON UPDATE RESTRICT` produces a raw foreign-key error, which must never
reach a user, so `features/projects/mutations.ts`'s `updateProject` refuses a `clientId` change with
a translated message when the project has any invoice, expense, contract, recurring schedule, or
proposal. `features/expenses/mutations.ts`'s `resolveExpenseScope` keeps its own check for the same
reason: it produces a better message than the database can, and the database is now the floor
beneath it rather than a replacement for it.

**Two deliberate non-decisions.** `expenses` gains no "not both null" parent check — an expense with
neither parent is legitimate, because a bank fee belongs to nobody. `invoices.client_id` stays
denormalised for the reason its column comment already gives.

## Consequences

### Positive

- A proposal can be written for a client before a project exists, which is the order the workflow
  actually happens in, and it survives the project being deleted.
- The disagreement between `project_id` and `client_id` is unrepresentable rather than merely
  discouraged. A new write path cannot reintroduce it by forgetting to copy the project's client.
- Re-parenting a project is refused at both ends — a translated message at the action boundary and a
  foreign key beneath it — so the silent corruption that motivated this ADR has no path left.
- The five tables now share one parentage shape, so `features/contracts` is a truthful exemplar for
  all of them instead of the accidental best case.

### Negative

- A project's client is now effectively immutable once any financial record exists. Correcting a
  genuine mistake means deleting or re-issuing the documents, and no supported "move this project"
  operation exists.
- The relationship is no longer visible in the Drizzle schema alone: `project_id` carries no
  `.references(...)`, and the constraint lives in hand-written migration SQL that a reader must open
  to see. Each column carries a comment naming the migration and the constraint for that reason.
- Every future dual-parent table has to remember three pieces — the composite key, the
  requires-client check, and a backfill when the table already holds rows — where one nullable
  foreign key used to do.
- `ON UPDATE RESTRICT` makes any legitimate future bulk re-parenting tool a multi-step operation
  rather than one `UPDATE`.

## Alternatives considered

### Derive `client_id` by joining through `project_id` and never store it

Removes the disagreement by removing the second copy: one parent column, no pair to keep in
agreement, no composite key. Rejected because it loses the client the moment the project row goes
away, which is the entire reason the denormalisation exists. A financial record must outlive its
project — `ON DELETE SET NULL` on `project_id` is deliberate — and an invoice whose client is only
knowable by joining a row that no longer exists is an invoice with no client. It also cannot express
the ad-hoc client document, which has no project to join through.

### A plpgsql trigger instead of the composite foreign key

A `BEFORE INSERT OR UPDATE` trigger comparing `client_id` against the parent project's, plus one on
`projects` rejecting a `client_id` change with dependents. Expressible without the unique index and
capable of a friendlier error message. Rejected because a trigger is procedural code that runs per
row and can be disabled, dropped, or bypassed by a session that turns triggers off — the precedent
in `0001_insert_only_guards.sql` exists because Postgres offered no declarative form of that rule,
which is not the case here. A declarative constraint is checked by the planner, is visible in
`information_schema`, and cannot be switched off; the friendlier message belongs at the action
boundary, where it now is.

### A proposal that quotes several projects, with projects created from its accepted line items

The genuinely different domain model: a proposal is a quote for a body of work, its line items each
describe a deliverable, and accepting it creates the projects. This would have made the proposal's
parentage a many-to-many and removed the question of a single project entirely. Rejected because it
is a different product decision, not a fix for an integrity defect: it contradicts ADR-0017's
mutually-exclusive line-item parent set, it introduces an accept-time conversion engine that decides
what a project is called and how it is scoped, and it makes the freelancer answer questions at
acceptance time that Remit deliberately does not ask. One proposal, one optional project, and the
freelancer creating projects when they want them keeps every stage of the workflow optional, which
is the property this ADR exists to restore.
