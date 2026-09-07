# ADR-0034: Retention windows, restore symmetry, and what an erasure cannot destroy

- **Status:** Accepted
- **Date:** 2026-09-07

## Context

[ADR-0010](0010-soft-delete.md) decided soft delete by default with "hard delete after the
configured retention window", and lists "users can restore accidentally deleted business records"
among its positive consequences. Sixteen tables carry `deleted_at` and every read excludes it, but
nothing in Remit ever cleared the column, no retention window existed to configure, and no code path
hard-deleted anything. Soft delete was a one-way door with a nullable column behind it.

This ADR **refines ADR-0010 rather than replacing it**. That decision — soft delete by default, hard
delete only after a window, explicit confirmation for a destructive cascade — stands unchanged and
is untouched. What follows decides the four questions it left open once the other half is built: how
many windows there are, what a restore does about the records deleted alongside the one being
restored, which storage objects a destruction removes, and what an erasure request cannot reach.

Three properties of the existing schema constrain every answer:

- **Soft delete does not cascade.** `softDeleteClient` stamps one row; the client's projects and
  invoices keep `deleted_at` null and stay visible in their own lists. Nothing in the product
  produces a deleted parent above a live child.
- **`audit_logs` and `contract_signatures` are insert-only**, enforced by BEFORE DELETE triggers in
  `0001_insert_only_guards.sql`. Deleting a contract cascades into its signature and the trigger
  raises.
- **A document must name a parent.** `chk_contracts_parent` and its siblings on `invoices` and
  `proposals` require a project or a client, and removing either parent nulls the corresponding
  column. A document therefore cannot outlive both of its parents.
- **Object deletion cannot join a database transaction**, which is why
  [ADR-0025](0025-instance-data-reset-scope.md) leaves storage untouched on a reset and
  [ADR-0028](0028-attachments-and-visual-identity.md) rejected an orphan sweeper.

## Decision

**Two retention windows, both null by default.** `settings.retention_trash_days` governs the general
records and `settings.retention_financial_days` governs invoices, credit notes, payments, contracts
and expenses; a check constraint refuses a financial window shorter than the general one. Null means
"never purge", which is what a freshly migrated instance has, so the first sweep after an upgrade
destroys nothing.

One window was the simpler option and was rejected: README's promise is a _fiscal_ retention window,
and the duration a deleted draft is worth keeping is not the duration a tax authority expects an
invoice to survive. Collapsing the two forces an owner to choose between purging nothing and purging
records they are legally required to hold. A window per entity would express more and be understood
by nobody: the distinction that carries meaning is financial versus not, and that is the one the
schema now names.

**Restore is the exact inverse of delete, and does not cascade.** Deleting a client stamps one row,
so restoring one clears one row. Cascading a restore was considered and rejected on a fact rather
than a preference: soft delete does not record _why_ a row was deleted, so a child deleted an hour
before its parent is indistinguishable from one deleted with it, and a cascading restore would
resurrect records the owner had already decided to remove. Adding a `deleted_by_cascade` column to
tell them apart was rejected as paying a schema change on sixteen tables to support a cascade that
does not exist.

**A restore into an inconsistent graph is refused, in a service and not by the database.** Restoring
an invoice whose client is still deleted would produce exactly the live-child-under-dead-parent
state ADR-0026's composite keys exist to prevent, and Postgres would not object because both rows
exist. `features/trash/services/restoreEligibility.ts` decides it, and the refusal names the parent
to restore first.

**Restore is owner-only**, the same gate as delete. An `assistant` cannot delete and therefore
cannot put anything in the trash; letting them take records out of it would be an asymmetric
privilege nobody asked for.

**The purge is one unattended sweep, and it walks the existing delete order.**
`retention.purge.sweep` runs daily on BullMQ (ADR-0023), reads the windows at run time, and iterates
`scripts/core/domainData/inventory.ts` — the same FK-safe array `remit:seed-demo` and
`remit:reset-data` already walk, extended with a `trash` and a `retention` decision per table rather
than duplicated into a second list. Its delete and its audit entry share one transaction, exactly as
`runResetData` does.

An operator-triggered `remit:purge-retention` CLI was considered and rejected: ADR-0020 requires a
real implementation, packaging, tests and documentation for a command, and the inspection it would
provide already exists in a place the person who owns the decision actually looks — the trash
surface dates every row with the day it will be removed, and `planRetentionPurge` reports the same
counts without writing.

**A countersigned contract is never purged.** Deleting it would cascade into `contract_signatures`,
and lifting that trigger — which `deleteDomainRows` does, inside an operator typing the instance
name — is not something an unattended 02:30 sweep may do. Such a contract stays in the trash
indefinitely.

**A client is purged only once no document names it.** Removing a client row nulls `client_id` on
every invoice, proposal and contract that survives it, and the parent checks above then reject the
statement — failing the whole nightly transaction, not one row. The purge therefore skips a client
while any of those three tables still references it, which is the ordinary case rather than an edge:
the documents are governed by the longer financial window, so a client is normally purged one window
after the records that name it.

**Neither the purge nor an erasure deletes a storage object.** Both delete rows only. The line is
drawn where ADR-0025 drew it for the reset command: an object delete cannot join the transaction, so
a failure after the files are gone reports a rolled-back operation over destroyed data. Orphaned
objects accumulate, exactly as ADR-0028 accepted, and reclaiming them remains the operation that
does not exist.

**The right to be forgotten is a separate, owner-initiated operation on a client**, confirmed by
typing the client's name (the shape `scripts/core/resetData/confirm.ts` uses, for the same reason:
nothing is left in place of what it removes), preceded by a prompt to export that client's data
first, and ignoring every retention window. It destroys the client, its contacts, projects, tasks,
proposals, contracts, invoices, credit notes, payments, time entries, expenses, attachments,
data-export records, and the activity and email log rows naming them.

**It is refused outright when the client has a countersigned contract**, and the refusal names how
many are in the way. The two schema facts above leave no third option: the contract cannot be
deleted, because that cascades into a signature nothing may delete; and it cannot be left standing,
because the erasure removes both of its possible parents and `chk_contracts_parent` rejects the
result. Refusing is the only outcome that neither destroys a counterparty's record nor half-erases
the subject and reports success.

**One thing survives an erasure that does run: the audit trail.** `audit_logs` is insert-only by
trigger and is never deletable by any flag (ADR-0025). Its entry names the event, the actor, the
client id and per-table counts — never the client's name, address or email.

"Everything is gone" would have been the simpler promise and is not the true one. The promise Remit
makes is "everything except the audit trail, and nothing at all while a signed contract stands".

## Consequences

### Positive

- ADR-0010's restore promise is true: every user-restorable record has a restore path, one
  discoverable surface, and a refusal that explains itself when the graph forbids it.
- An upgrade destroys nothing. A window is something an owner turns on after reading what it will
  remove, with the date visible on every row before it arrives.
- The purge cannot drift out of foreign-key order, because it does not own an order — it walks the
  one two CLI commands already depend on, and a restorable table with no purge source fails loudly.
- The erasure promise matches what the database actually permits, so nobody has to discover the
  exception during a subject access request.

### Negative

- A countersigned contract can never be purged, and it blocks the erasure of its client entirely.
  The owner discovers that only when the erasure refuses; nothing warns them earlier, and the trash
  simply keeps showing the row.
- A client with a long-lived document is purged much later than its own window implies, because the
  documents naming it hold it back. Nothing on the trash surface explains that delay.
- Storage objects outlive both the purge and the erasure. A client's attached files remain in the
  bucket after their rows are gone, and only an operator with bucket access can remove them.
- Two windows are two numbers to understand, and the constraint between them (financial never
  shorter) is discoverable only by trying to save the wrong pair.
- The trash lists at most 200 rows and does not paginate. An instance that exceeds that is telling
  the owner to configure a window, but the surface says so only implicitly.
- Restore is owner-only, so an assistant who watches a record disappear cannot bring it back.

## Alternatives considered

### One retention window for everything

Simplest to configure and to explain. Rejected because it forces the owner to pick a single number
for a deleted draft and a paid invoice, and any number that is safe for the invoice makes the trash
useless as a trash.

### A cascading restore

What "undo" means to most users: restoring a client brings its invoices back. Rejected because soft
delete records no provenance, so the cascade cannot tell a record deleted with the parent from one
deleted deliberately before it, and would silently resurrect the second kind. The refusal-plus-order
model reaches the same end state — restore the client, then the invoice — without guessing.

### Lifting the `contract_signatures` trigger inside the purge

The reset command does exactly this, so the precedent exists. Rejected because that lift sits behind
an operator typing the instance's name at a terminal, and this sweep runs unattended every night. A
guard whose whole purpose is to make a class of deletion impossible should not be liftable by a cron
entry.

### Deleting the storage objects reachable from purged rows

`uq_attachments_upload_id` makes an attachment's upload provably single-referenced, so the subset is
identifiable. Rejected for now because the delete still cannot join the transaction: identifying the
objects safely does not make removing them atomic, and a partial failure destroys files while the
rows survive. Revisitable behind the same evidence ADR-0028 asked for.

### Erasing everything except the countersigned contract

The partial erasure, and the one this ADR originally specified. Rejected on a fact rather than a
preference: `chk_contracts_parent` requires the surviving contract to name a project or a client,
and the erasure removes both, so Postgres rejects the whole transaction. It is not an option that
exists.

### Lifting the signature guard for an erasure specifically

Would make the erasure total. Rejected for the same reason the purge does not lift it, and more
strongly: an erasure request from one party is not authority to destroy another party's record of
what they signed.
