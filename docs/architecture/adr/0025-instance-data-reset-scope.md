# ADR-0025: Instance data reset — domain data versus instance state

- **Status:** Accepted
- **Date:** 2026-08-18

## Context

`pnpm remit:seed-demo` populates an instance with demo data, and `--reseed` replaces it. Neither
undoes it. An operator who demoed or experimented on an instance has only one way back to an empty
one: drop the database, re-run migrations, and repeat `/register` and `/setup` — losing the account,
the TOTP enrolment, the business profile, the provider configuration, and the authored templates
alongside the demo rows they actually wanted gone.

Providing the inverse operation forces a question the codebase had never answered explicitly: which
tables are _domain data_ an instance accumulates, and which are _instance state_ that defines the
instance itself. `SEED_INVENTORY` in `scripts/core/seedDemo/` was the closest thing to an answer,
but it recorded only what the seed writes, which is a different question — `contract_signatures` is
never seeded yet must be cleared by a reseed, and `tax_rates` is seeded yet is configuration an
operator authored.

Getting the classification wrong is unrecoverable in one direction and useless in the other: a reset
that deletes too much destroys operator configuration, and one that deletes too little leaves a
dashboard referring to entities that no longer exist.

## Decision

Remit ships `pnpm remit:reset-data`, a peer of `remit:seed-demo` rather than a flag on it, governed
by ADR-0020's operational CLI contract.

**One classification, three decisions.** `scripts/core/domainData/inventory.ts` holds
`DOMAIN_DATA_INVENTORY`: one entry per table exported from `database/schema/index.ts`, carrying an
explicit decision for each of the three operations that touch table contents — what the seed writes,
what `--reseed` replaces, and what a reset deletes. The three genuinely differ, so a single
seed/skip column cannot express them. A table missing from the inventory fails a test; there is no
second list anywhere, and the array order is itself the FK-safe delete order that both commands
walk.

**Instance state a reset preserves.** Better Auth-owned tables (`users`, `accounts`, `sessions`,
`verifications`, `two_factors`, `organizations`, `members`, `invitations`), the `settings` row,
`tax_rates`, `templates`, and `audit_logs`. The operator stays logged in, TOTP stays enrolled, and
an invitation nobody accepted yet still works. `tax_rates` and `templates` are authored
configuration, not domain data, even though the seed writes them.

**Domain data a reset deletes.** The document and work-tracking domain, the runtime artifacts of
those rows (`activity_logs`, `email_logs`, `data_exports`, `proposal_otps`, `contract_signatures`),
and the `uploads` rows the deleted documents referenced. Keeping a feed and a delivery log that
point at entities which no longer exist is worse than deleting them.

**Four scope decisions that are not obvious from the classification alone:**

- **Document numbering is not rewound.** `nextInvoiceNumber` and its siblings keep their values, so
  the first invoice after a reset continues the previous series. A number that already appeared in
  an exported PDF or an email a client received is never re-issued; a cosmetically odd `INV-0148` is
  preferable to a second, different `INV-0042`.
- **`audit_logs` is never deletable, by any flag.** An audit trail a maintenance command can erase
  is not an audit trail. The insert-only trigger from migration `0001` is lifted for
  `contract_signatures` and never for `audit_logs`.
- **Object storage is untouched.** Only the `uploads` rows are deleted, leaving the objects behind
  them orphaned. Deleting objects cannot join the database transaction, so a later failure would
  leave files already gone with rows intact. Orphaned storage is a cost; a partial delete is data
  loss.
- **The queue drain is best-effort.** BullMQ jobs keyed to deleted invoices and schedules are
  obliterated after the transaction commits. An unreachable Redis produces a warning, never a
  failure: the reset has already happened, and reporting failure for a committed operation would be
  a lie.

**Safety.** The whole delete plus the audit entry run in one transaction — a rollback restores the
lifted trigger with everything else, so no session-level trigger disabling is needed. Confirmation
is a typed phrase (the instance's business name), not a yes/no, because unlike `--reseed` a reset
leaves nothing in place of what it removed. Every run writes one `audit_logs` entry with
`actorUserId: null` and per-table deleted counts.

## Consequences

### Positive

- A demoed or experimented-on instance returns to "configured but empty" without losing the account
  or a single setting, which is what makes demo seeding safe to use on a real installation.
- Seed and reset share one delete implementation and one classification, so a table added to the
  schema cannot be handled by one command and silently missed by the other.
- The distinction between domain data and instance state is now written down and test-enforced
  rather than implied by what a seed happens to write.

### Negative

- Every new table needs a deliberate three-way decision before it can ship, and the completeness
  test blocks the schema change until it has one.
- Storage objects behind deleted documents accumulate across reset cycles with nothing referencing
  them; reclaiming them needs a separate operation that does not exist yet.
- Document numbers after a reset look discontinuous with an instance that has no documents, which
  reads as a bug until the reasoning is known.

## Alternatives considered

### A `--reset` flag on `remit:seed-demo`

Reuses the existing entrypoint and its inventory. Rejected because the two commands answer to
different operators and different risk levels: seeding is additive and reversible, resetting is
neither, and a destructive mode reachable by a flag on a demo tool invites the wrong confirmation
ergonomics. The shared classification delivers the reuse without the shared entrypoint.

### Drop the database and re-run `/register` and `/setup`

Already possible and needs no code. Rejected because it destroys exactly the state an operator wants
to keep — the account, TOTP enrolment, business profile, provider configuration, and templates — and
because the re-setup flow is precisely the friction the operation exists to remove.

### Rewind the numbering counters to 1

Produces a genuinely brand-new-looking instance. Rejected because it re-issues document numbers that
may already exist in PDFs and emails outside the system, turning a cosmetic annoyance into an
accounting hazard.

### Delete the storage objects behind removed uploads

Leaves no orphans. Rejected as the default because object deletion cannot participate in the
database transaction: a failure after the objects are gone would report a rolled-back reset while
the files were already destroyed. The rows-only delete keeps the operation genuinely all-or-nothing.
