# ADR-0033: A late fee is part of the invoice total, charged once, and off by default

- **Status:** Accepted
- **Date:** 2026-09-06

## Context

`invoices.late_fee_cents` has existed since the invoicing schema landed. It is check-constrained
non-negative, it reaches every rendered document as the `invoice.lateFee` merge variable, and it
travels in the data export. Nothing ever wrote it — not a mutation, not a job, not the demo seeder.

Giving it a writer forces one question that decides everything else: **where does the fee sit
relative to the money the invoice already states?** Three placements are possible and they are not
interchangeable, because seven surfaces already answer "what is this invoice worth" and "what is
still outstanding" from `total_cents` and `amount_paid_cents`: the invoice detail, the invoices
list, the client invoices panel, the public invoice page, the client portal, the dashboard
receivables panel, and the credit-note editor. A placement that leaves any of them out produces two
numbers for one invoice.

Two further questions follow from it: whether a fee accrues once or repeatedly, and what happens on
an instance that upgrades into this stage without asking for anything.

## Decision

**The fee is added into `total_cents`, and `late_fee_cents` records how much of that total is fee.**
Applying a fee is a single UPDATE that sets the column and increments the total by the same amount.
Everything that already reads `total_cents` is therefore correct with no change and no knowledge
that late fees exist: the outstanding balance in `services/invoiceStatusView.ts`'s
`getInvoiceOutstandingCents`, the settlement decision in
`features/payments/services/paymentSettlement.ts`, the Stripe checkout amount, the dashboard
receivables, the credit-note editor's effective receivable, and the `invoice.amountDue` merge
variable. The rendered document shows the fee as its own line beside subtotal, discount and tax, so
the arithmetic on the page still adds up.

The alternative placements are worse in specific ways, not merely different. A fee that sits
_beside_ the total cannot be paid: `chk_invoices_amount_paid` bounds `amount_paid_cents` at
`total_cents`, so a client settling the invoice plus its fee would be rejected as an overpayment,
and each of the seven surfaces above would need its own fee-aware variant of the same sum — seven
chances to disagree. A fee expressed as a **line item** would enter `calculateInvoiceTotal` and
therefore the tax base, silently treating a penalty as a taxable supply, and would rewrite the line
set of a document the client already holds, against the snapshot rule recorded at the top of
`database/schema/lineItems.ts`.

**Writing to an issued invoice is legitimate here, and only here.** Every other write path refuses a
non-draft because an edit would revise what the client agreed to. A late fee revises nothing: it is
a consequence of the client not paying by the date that same document named. The audit entry beside
each application records the amount, the days late and the policy as it stood that night.

**A fee is charged once per invoice, never recurring.** `late_fee_cents` is one scalar, not a
ledger; a monthly compounding fee would accumulate into it with the per-period history existing only
in the audit trail, and the idempotency key would have to identify a period rather than an invoice.
One charge on crossing the grace period is predictable, is what a flat statutory recovery fee looks
like, and leaves the recurring variant available later as a schema change rather than as a silent
reinterpretation of a column.

**Idempotency is the column, not the audit trail.** The applying UPDATE is conditional on
`late_fee_cents IS NULL`, so a sweep run twice in one night, or a worker restarting mid-run, charges
exactly once — and a waived fee, which is `0` rather than null, is never reassessed. This
deliberately differs from the sibling overdue announcement in `features/invoices/jobs.ts`, whose
dedupe key is a query against `audit_logs` because no column on the invoice would otherwise record
that it had announced. Here the column exists, is read by the document, and cannot be lost to the
best-effort audit insert in `lib/audit/index.ts`.

**The policy is per-instance and off by default.** It lives in six `settings.late_fee_*` columns
with `late_fee_enabled` defaulting to `false`, because these columns arrive on instances that have
been invoicing for months and an upgrade must not start charging a self-hoster's existing clients on
the first night the worker runs.

**The owner can override or waive a charged fee.** The adjustment moves `total_cents` by the
difference, refuses to drop the total below what has already been paid — that is a credit note or a
refund, not an edit — and lets the settlement follow the total through the same
`evaluateInvoiceSettlement` the payment path uses, so waiving a fee on an otherwise fully paid
invoice settles it rather than leaving the status disagreeing with the amounts beside it.

## Alternatives considered

**A percentage of the invoice total rather than of the outstanding balance.** Rejected: a client who
has paid four fifths of an invoice is late on the remaining fifth, and charging a percentage of the
whole would charge them for money already received.

**Per-client late-fee overrides.** `clients` has precedent for per-client defaults
(`default_hourly_rate_cents`, `locale`, `currency`), so the shape was available. Rejected for now:
nothing in the documents or the gap ledger asks for it, it doubles the policy resolution and the
settings surface for a feature that is off by default, and a per-client column nobody sets is dead
weight. A later stage that wants it adds one column and one resolution step, with the pure service
already taking the policy as an argument.

**A separate `JobMap` entry for late-fee application.** Rejected: the candidate set is the overdue
sweep's candidate set, so a second nightly schedule would re-run the same query on the same clock,
and two jobs that must agree about which invoices are late is one more thing that can drift apart.
The application is a module of its own (`features/invoices/lateFees.ts`) called at the end of the
sweep, which keeps `jobs.ts` under its line ceiling without cutting a job in half.

**Clearing the policy columns when the switch is turned off.** Rejected: an operator who disables
fees for a month should find their terms intact when they turn them back on.
`chk_settings_late_fee_enabled_shape` only constrains the other direction — enabling requires a
configured amount.

## Consequences

Positive: every surface that reports what an invoice is worth or what is outstanding accounts for
the fee without being changed, because there is exactly one place the fee enters the money. A client
can pay an invoice that carries a fee through any path, including Stripe checkout, because the
balance the server derives already includes it. A repeated sweep, a worker restart and a
concurrently landing payment each fail closed.

Negative: `total_cents` on an issued invoice is no longer identically the sum of its line items plus
tax less discounts — it is that plus `late_fee_cents` — so a reader reconciling the two must account
for the fee, which is why the document renders it as its own line and `SCHEMA.md` says so on both
columns. A waived fee is `0` rather than null and is therefore indistinguishable from a fee of zero
that was never charged; the audit trail is what tells them apart. A fee is charged once, so an
instance wanting monthly interest is not served by this stage.
