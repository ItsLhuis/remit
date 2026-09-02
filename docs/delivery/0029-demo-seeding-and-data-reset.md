# DR-0029: Demo data seeding and instance data reset

- **Status:** Shipped
- **Date:** 2026-08-18
- **Verdict:** Complete
- **Decisions:** ADR-0025
- **Supersedes:** —
- **Reconstructed:** yes

## What

`pnpm remit:seed-demo`, which fills an instance with deterministic demo data, and
`pnpm remit:reset-data`, its inverse, which empties the instance's domain data in one transaction
while leaving the account and configuration intact.

## Why

An empty Remit shows nothing: no dashboard, no reports, no cashflow. Screenshots, screencasts and
demo deployments all need an instance that looks lived in, and one built by hand is different every
time. The reset exists because seeding without an undo is a one-way door — and because "empty the
business data but keep my account and settings" is a real operator need that no other command
served.

They are one record because they are two halves of one capability and share the inventory that
defines what domain data is.

## Scope

Included: deterministic seeding of settings, tax rates, leads, clients, projects, tasks, time
entries, expenses, proposals, invoices, line items, payments, credit notes, contracts and recurring
schedules, with size presets and bounded numeric overrides, a fixed seed, `--dry-run` and
`--reseed`; and a reset deleting those rows plus their runtime artefacts and the `uploads` rows the
documents referenced, in one transaction, with a typed confirmation and a best-effort queue drain.

Excluded from both: Better Auth-owned tables. Seeding creates no users, organizations or memberships
and expects an owner to exist from registration; reset never touches them. Excluded from reset
additionally: the `settings` row, `tax_rates`, `templates` and `audit_logs` — the classification is
ADR-0025's subject, and the audit trail in particular must survive the operation that empties the
instance, or the record of the reset would be deleted by the reset.

## How

Both commands read one shared inventory in `scripts/core/domainData/inventory.ts` that defines what
counts as domain data and in what order it can be deleted. That is what keeps them honest as
inverses: a table added to the seeder is a table the reset knows how to empty, without two lists
agreeing by memory.

Seeding is deterministic from a seed value, so the same seed produces the same instance and a
screenshot can be reproduced months later.

The reset's confirmation is a typed business name — read from `settings`, or `DELETE` when the
instance has none — rather than a yes/no prompt, because a destructive default-no prompt is still
one keystroke from catastrophe. It runs in a single transaction, so a failure leaves the instance
intact rather than half-emptied.

Seeding refuses to run when seedable rows already exist unless `--reseed` is given, so it cannot
quietly double a demo instance.

Document numbering counters are deliberately not rewound by the reset, and objects in the configured
store are not deleted — only the database rows that pointed at them. Both are recorded in the CLI
contract because both would otherwise surprise an operator.

## Evidence

- `scripts/seed-demo.ts`, `scripts/core/seedDemo/` — `runSeedDemo.ts`, `plan.ts`, `inventory.ts`,
  `profile.ts`, `args.ts`
- `scripts/reset-data.ts`, `scripts/core/resetData/` — `runResetData.ts`, `plan.ts`, `confirm.ts`,
  `queueDrain.ts`, `args.ts`
- `scripts/core/domainData/inventory.ts`, `deleteDomainRows.ts` — the shared inventory
- `scripts/core/audit/operationalAudit.ts` — `instance.reset_data.completed` with per-table counts
- `docs/architecture/adr/0025-instance-data-reset-scope.md`
- `docs/architecture/operations/CLI-CONTRACT.md` — the `pnpm remit:seed-demo` and
  `pnpm remit:reset-data` sections

## Verification

`scripts/core/seedDemo/__tests__/seedDemo.integration.test.ts` and
`resetData/__tests__/resetData.integration.test.ts` run both commands against the Dockerized test
Postgres, and the reset test asserts the excluded tables survive.
`domainData/__tests__/inventory.integration.test.ts` is the guard that matters most: it checks the
shared inventory against the live schema, so a new domain table that neither command knows about is
a test failure rather than a row that quietly survives a reset. Unit tests cover plan building, size
presets, bounded overrides and argument parsing.

Not covered by an automated test: the interactive typed confirmation, exercised through the `--yes`
path with the prompt stubbed.

## Known gaps

The reset does not rewind document numbering counters and does not delete objects from the
configured store, only the rows referencing them.
