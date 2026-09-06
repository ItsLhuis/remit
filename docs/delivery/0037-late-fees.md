# DR-0037: Automatic late fees

- **Status:** Shipped
- **Date:** 2026-09-06
- **Verdict:** Complete with known gaps
- **Decisions:** ADR-0007, ADR-0009, ADR-0023, ADR-0033
- **Supersedes:** —

## What

An overdue invoice is charged a late fee once, by the nightly sweep that already announces it went
late, under a per-instance policy that is off until an owner configures it.

## Why

`invoices.late_fee_cents` shipped with the invoicing schema and had readers but no writer. It was
check-constrained, carried into every rendered document as the `invoice.lateFee` merge variable and
exported in the data archive, and the value was always null because nothing anywhere set it — not a
mutation, not a job, not the demo seeder. README claimed Remit had automatic late-fee logic; the
only thing automatic about it was the absence.

## Scope

Included: the six `settings.late_fee_*` policy columns and their settings surface; the pure
assessment service; the application inside the existing `invoice.overdue.sweep`; the owner's
override and waive path; the fee on the invoice detail and in the invoice's totals; the fee in the
overdue reminder email; the policy columns in the data export.

Excluded, deliberately:

- **Recurring or compounding fees.** `late_fee_cents` is one scalar and not a ledger; a monthly fee
  would accumulate into it with the per-period history living only in the audit trail. One charge
  per invoice is what shipped, and ADR-0033 records why.
- **Per-client policy overrides.** `clients` has the precedent, nothing asks for it, and a level
  nobody sets is dead weight. The pure service already takes the policy as an argument, so a later
  stage adds one column and one resolution step.
- **A `JobMap` entry of its own.** The candidate set is the overdue sweep's candidate set.
- **Manually charging a fee on an invoice that has none.** The owner adjusts or waives a fee the
  sweep charged; there is no path that creates one by hand.

## How

The fee is added into `invoices.total_cents` and `late_fee_cents` records how much of that total is
fee — the decision ADR-0033 exists for. Everything that already answers "what is this invoice worth"
or "what is still outstanding" reads `total_cents`, so the invoice detail, the invoices list, the
client invoices panel, the public invoice page, the client portal, the dashboard receivables and the
Stripe checkout amount are all correct without being touched.

The assessment is pure and takes the clock, the policy and the invoice's own amounts as arguments.
The percentage is taken on the outstanding balance rather than the face value, and rounded to whole
cents exactly once, at the point the percentage becomes money.

The application is one conditional UPDATE predicated on `late_fee_cents IS NULL`, which is both the
claim and the idempotency key: a sweep run twice, or a worker restarting mid-run, charges once, and
a waived fee — `0`, not null — is never reassessed. The statement re-checks `paid_at`, so a payment
that commits after the candidate is read turns the charge into a miss. This differs from the sibling
overdue announcement, whose dedupe key is a query against `audit_logs`, and the reason is written at
the write site: here a column exists that the document already reads, and it cannot be lost to the
best-effort audit insert.

Writing to an issued invoice is legitimate only here, and the write site says why: a late fee
revises nothing the client agreed to, it is a consequence of their not paying by the date the same
document named.

The owner's adjustment moves the total by the difference under a `FOR UPDATE` lock, refuses to drop
the total below what has been paid, and lets the settlement follow the total through the same
`evaluateInvoiceSettlement` the payment path uses — so waiving a fee on an otherwise fully paid
invoice settles it instead of leaving the status disagreeing with the amounts beside it.

## Evidence

- Policy columns and their six checks: `database/schema/settings.ts`, `database/schema/enums.ts`
  (`late_fee_type`), migration `drizzle/migrations/0004_pink_virginia_dare.sql`.
- Pure assessment: `features/invoices/services/lateFee.ts`, tested in
  `features/invoices/services/__tests__/lateFee.test.ts` (23 cases).
- Application: `features/invoices/lateFees.ts`, called at the end of `runOverdueSweep` in
  `features/invoices/jobs.ts`; tested in `features/invoices/__tests__/lateFees.integration.test.ts`.
- Owner override and waive: `adjustInvoiceLateFee` in `features/invoices/mutations.ts` behind
  `requireInvoiceLateFee` in `features/invoices/mutationContext.ts`, registered in
  `doctor.config.ts`; tested in `features/invoices/__tests__/lateFeeAdjustment.integration.test.ts`.
- Settings surface: `features/settings/invoicing/schemas.ts`, `queries.ts`, `mutations.ts` and
  `components/InvoicingSettingsPage/LateFeeSection.tsx`; tested in
  `features/settings/invoicing/__tests__/schemas.test.ts` and
  `features/settings/invoicing/__tests__/mutations.integration.test.ts`.
- Detail surface: `features/invoices/components/InvoiceDetailPage/InvoiceLateFeeCard.tsx` and the
  late-fee row in `InvoiceSummaryCard.tsx`; read model in `features/invoices/queries.ts`
  (`getInvoiceLateFee`) and `features/invoices/types.ts` (`InvoiceLateFee`).
- Feed entry: `invoice.late_fee_applied` in `lib/events/types.ts`, emitted from
  `features/invoices/lateFees.ts`, subscribed in `features/activityLog/events.ts`.
- Reminder copy: `renderReminderBody` in `features/invoices/jobs.ts`.
- Export decision: the six columns in `features/dataExport/services/exportInstanceTables.ts`, under
  the billing-terms boundary stated in `features/dataExport/services/exportManifest.ts`.
- Documents: `docs/architecture/SCHEMA.md` sections 7, 23 and 29;
  `docs/architecture/ARCHITECTURE.md` key invariants and the ADR table; `README.md` invoices
  paragraph; `docs/architecture/adr/0033-late-fee-placement.md`.

## Verification

`pnpm typecheck`, `pnpm lint` (no new warnings; the two `max-lines` warnings that remain are on
files this work did not touch), `pnpm test` (235 files, 2127 tests), `pnpm test:integration` (72
files, 738 tests) and `pnpm build` all pass. `pnpm database:generate` reports no schema changes once
migration `0004` is applied.

`features/invoices/services/lateFee.ts` is at 100% statements, branches, functions and lines. The
repository-wide `features/**/services/**` branch threshold is **not** met and was not met before
this work: measured with the new service excluded it is 84.83%, and with it included 85.09%, so this
delivery moved the number up and did not cause the failure. The shortfall is concentrated in
`features/creditNotes/services` (45.83% branches), `features/settings/payment/services` (66.66%) and
`features/proposals/services` (77.77%), none of which this work touched.

The application is exercised against real Postgres through the `invoice.overdue.sweep` handler taken
from the same registry `scripts/worker.ts` registers into, matching
`features/recurringInvoices/__tests__/generation.integration.test.ts`; that a job has a registered
handler at all is proved for every job by `lib/jobs/__tests__/jobCatalog.integration.test.ts`. The
queue is stubbed at the module boundary there, so the integration suite proves the handler body
rather than a Redis round trip.

It was additionally smoke-tested end to end against the development instance with Redis and the real
worker running, driving `invoice.overdue.sweep` through BullMQ rather than calling it: with the
policy off no fee was charged; with a 5%-of-outstanding policy and no grace, an invoice outstanding
at €1,691.25 was charged €84.56 — `round(169125 × 0.05) = 8456` — and its total moved to €1,775.81;
a second sweep the same night changed nothing and wrote no second audit entry; a waived fee stayed
waived across a further sweep and returned the total to €1,691.25; and a settled invoice accrued
nothing. The invoice detail, the invoices overview row and the dashboard receivables tile agreed on
every figure, the dashboard total moving by exactly the fee when it was waived.

Not covered: the rendered PDF was verified as far as the merge data — `invoice.lateFee` resolves to
€84.56 and `invoice.amountDue` to €1,775.81 in `buildInvoiceDocumentData` — but not as printed
bytes, because Remit ships no default templates and the development instance has no invoice template
placing the token. The overdue reminder email was not sent: the development instance has no email
provider configured, so the send path returns before rendering. The `LateFeeSection` and
`InvoiceLateFeeCard` components have no component tests. The waive used in the smoke was applied by
SQL rather than through the server action, which is covered instead by
`features/invoices/__tests__/lateFeeAdjustment.integration.test.ts`.

## Known gaps

- A waived fee is stored as `0` and is indistinguishable from a fee of zero that was never charged
  except through the audit trail.
- The fee is charged once. An instance wanting monthly interest is not served.
- The policy is per-instance only; a client on different terms needs the fee adjusted by hand after
  it is charged.
- `invoice.lateFee` renders in a document only if the instance's template places the variable. Remit
  ships no default templates, so an operator who has not added the token to their invoice template
  sees the fee in the app and not on the PDF.
