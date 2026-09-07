# DR-0038: Trash, restore, retention and erasure

- **Status:** Shipped
- **Date:** 2026-09-07
- **Verdict:** Complete with known gaps
- **Decisions:** ADR-0010, ADR-0020, ADR-0023, ADR-0025, ADR-0026, ADR-0028, ADR-0034
- **Supersedes:** —

## What

Deleted records can be restored from one surface, two configurable retention windows decide when
they are destroyed instead, and an owner can erase a client outright.

## Why

ADR-0010 shipped soft delete as half a decision. Sixteen tables carried `deleted_at`, every read
excluded it, and nothing anywhere cleared it: there was no restore mutation, no trash surface, no
retention setting and no hard-delete path. `ARCHITECTURE.md` promised records restorable from a
trash view and hard-deleted after a configurable period, and README promised "the right to be
forgotten with a configurable fiscal retention window". Deleting from Remit was a one-way door with
a nullable column behind it.

## Scope

Included: fifteen restore mutations, one per user-restorable entity; a service-level refusal for a
restore that would leave a live record under a deleted parent; the trash surface and the retention
form on `/settings/data`; two `settings` retention columns with their checks; a nightly BullMQ purge
that reuses the existing FK-safe delete order; the owner's client erasure with typed-name
confirmation; and the `trash` and `retention` decisions added to the domain inventory.

Excluded, deliberately:

- **A cascading restore.** Soft delete does not cascade, so restore does not either, and soft delete
  records no provenance that would let a cascade tell a record deleted with its parent from one
  deleted deliberately before it (ADR-0034).
- **An operator CLI for the purge.** ADR-0020 requires a real implementation, packaging, tests and
  docs for a command, and the inspection it would add already exists where the owner looks: the
  trash dates every row, and `planRetentionPurge` reports the same counts without writing.
- **Storage-object deletion.** Both the purge and the erasure delete rows only, on ADR-0025's
  reasoning for the reset command and ADR-0028's for its rejected sweeper.
- **A `line_items` trash entry.** It carries `deleted_at` but has no life apart from the document
  above it, so it is classified `cascade` and never listed.
- **Restore for `assistant`.** That role cannot delete, so it can put nothing in the trash.

## How

The classification lives in `scripts/core/domainData/inventory.ts` rather than in a second list.
That file already held the seed, reseed and reset decisions and its array order is the FK-safe
delete order; this work added a `trash` and a `retention` decision per table and had the purge walk
the same array. The import direction is the reverse of the usual one — application code importing
from `scripts/` — which is deliberate and commented: the file is a plain const array with a
type-only Drizzle import, and a second classification that could disagree with the first is the
failure it exists to prevent.

`features/trash/index.ts` exports only pure services, schemas and read-model types, while
`server.ts` exports the components and the dispatcher. That split is what keeps the cycle open:
fifteen feature mutations import `resolveRestoreBlocker` from the client-safe barrel, and the
dispatcher imports those fifteen features from the server barrel, so the two never meet.

Two schema facts shaped the outcome more than any preference. A countersigned contract cannot be
purged, because deleting it cascades into an insert-only `contract_signatures` row. And a client
cannot be removed while an invoice, proposal or contract still names it, because that nulls the
document's `client_id` and `chk_contracts_parent` and its siblings reject the statement — failing
the whole transaction rather than one row. The purge guards against both; the erasure refuses
outright when a countersigned contract stands, which is the only outcome that neither destroys a
counterparty's record nor half-erases the subject while reporting success. ADR-0034 records that
reasoning and the alternatives it closes.

## Evidence

- Restore paths: `features/clients/restoreMutations.ts`, `features/contracts/restoreMutations.ts`,
  `features/invoices/restoreMutations.ts`, `features/proposals/restoreMutations.ts`, and the
  `restore<Entity>` actions in
  `features/{leads,projects,tasks,creditNotes,payments, recurringInvoices,timeTracking,expenses,templates}/mutations.ts`
  and `features/settings/tax-rates/mutations.ts`.
- Restore eligibility: `features/trash/services/restoreEligibility.ts`, tested in
  `features/trash/services/__tests__/restoreEligibility.test.ts`.
- Payment restore re-derives the invoice aggregate under the invoice lock:
  `features/payments/paymentWrites.ts`'s `restorePaymentWrite`.
- Retention windows: `settings.retentionTrashDays` / `retentionFinancialDays` in
  `database/schema/settings.ts`, migration `drizzle/migrations/0005_ordinary_titanium_man.sql`,
  documented in `docs/architecture/SCHEMA.md` section 7.
- Window arithmetic: `features/trash/services/retentionWindow.ts`, tested in
  `features/trash/services/__tests__/retentionWindow.test.ts`.
- Purge: `features/trash/purge.ts` and `features/trash/jobs.ts`, scheduled in
  `lib/jobs/schedules.ts`, registered in `lib/jobs/types.ts` and
  `scripts/core/worker/loadWorkerFeatureModules.ts`.
- Classification: the `trash` and `retention` fields in `scripts/core/domainData/inventory.ts`, with
  completeness enforced in `scripts/core/domainData/__tests__/inventory.integration.test.ts`.
- Surfaces: `features/trash/components/TrashSection/`, mounted by
  `features/dataExport/components/DataSettingsPage/DataSettingsPage.tsx`;
  `features/clients/components/ForgetClientDialog.tsx`, wired from `ClientWorkspace`.
- Erasure: `features/clients/forget.ts` and `features/clients/forgetMutations.ts`.
- Export policy for the new columns: `features/dataExport/services/exportInstanceTables.ts`.
- Decision: `docs/architecture/adr/0034-retention-and-erasure.md`.

## Verification

`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:integration` and `pnpm build` all pass, as do
react-doctor and fallow against their configs. `pnpm database:generate` reports no schema changes
after the migration was applied to the test database.

The integration tests assert the behaviour rather than the implementation: a restored client returns
to its list read with an audit entry; an invoice and a project whose client is still deleted are
refused with a translated message and no write; the same child restores once its parent is back; an
`assistant` is refused. The purge tests fix the clock by argument rather than by
`vi.useFakeTimers()` — freezing timers stalls the postgres driver and hangs every query in the file
— and assert that a row one day inside the window survives while one a day outside does not, that
the financial window governs invoices, that a signed contract and a client with live documents are
both left alone, that every pre-existing `audit_logs` row survives and the purge adds its own, that
the delete order is the inventory's, and that the dry run writes nothing.

Not covered by automated tests: the trash surface and the erasure dialog have no component tests,
and no E2E flow exercises delete → restore in a browser. The manual smoke below stands in for them.

## Known gaps

- A countersigned contract can never be purged, and it blocks its client's erasure entirely. Nothing
  warns the owner before the refusal, and the trash keeps listing the row with no explanation of why
  its removal date never arrives.
- A client is held back from the purge by any document naming it, so its effective window is the
  financial one. The trash still shows the date its own window implies.
- Storage objects survive both the purge and the erasure. An erased client's attached files remain
  in the bucket, reachable only by an operator with bucket access.
- The trash lists at most 200 rows and does not paginate.
- `features/{contracts,invoices,proposals}/mutations.ts` were at the 500-line lint ceiling, so their
  restore actions sit in a sibling `restoreMutations.ts` rather than beside their `softDelete`
  sibling as `actions.md` would place them.
- Restore writes an audit entry but emits no domain event, because no feature consumes one.
