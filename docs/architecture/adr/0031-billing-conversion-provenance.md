# ADR-0031: Billing conversion — grouped lines, single-source provenance, and refusal over inference

- **Status:** Accepted
- **Date:** 2026-09-05

## Context

Time entries and re-billable expenses carry `invoiced_in_id`, and line items carry
`source_time_entry_id` and `source_expense_id`. Both pairs of columns, their partial indexes and the
rate-precedence service existed from the beginning, and nothing joined them: no application path
turned tracked work into an invoice line, and the two `source_*_id` columns had no writer outside
the demo seeder. `features/recurringInvoices/jobs.ts` wrote `invoiced_in_id` on its retainer branch
and never the per-line columns, an asymmetry
[Architecture: Domain model](../ARCHITECTURE.md#key-invariants) recorded without resolving.

Building the conversion forces four questions that a later stage writing line items from source rows
will meet again, and that a rewritten paragraph in `ARCHITECTURE.md` would not preserve: what a
grouped line may claim as its source, what a selection that resolves to no single invoice should do,
where a duration becomes a quantity, and which rate a converted line is priced at.

## Decision

**A per-line source id is written only when the line is drawn from exactly one source row.** A line
grouped from several entries carries neither `source_time_entry_id` nor `source_expense_id`, because
naming one member would assert of the whole line a fact true of only part of it.
`time_entries.invoiced_in_id` and `expenses.invoiced_in_id` remain the complete "this was billed, on
that invoice" answer for every row, and neither column is ever derived from the other. Expenses are
never grouped — one line per expense — so their provenance is always present.

This makes `features/recurringInvoices/jobs.ts` compliant rather than exceptional: its overage line
aggregates many entries and the hours inside the retainer pool are billed by the blueprint's own fee
line, which has no source row at all, so both correctly carry no per-line provenance. The retainer
branch is left as it is.

**A selection that cannot become one invoice is refused, never inferred.** Two currencies are
refused rather than summed or converted at an exchange rate no source supplies. Two clients are
refused rather than split into two invoices nobody asked for, because
[ADR-0026](0026-document-parentage.md)'s composite key admits exactly one client per document. A
selection spanning two projects of one client produces the client-level invoice that ADR already
allows, naming no project.

**A duration becomes a quantity once, per line, at the hundredth of an hour.** The seconds in a
group are summed and then rounded, never rounded per entry and summed, so a line's quantity matches
the seconds actually worked to within one hundredth. A group that rounds to zero is reported as
unbillable and left unbilled rather than clamped to the smallest writable quantity.

**A converted line is priced from `time_entries.hourly_rate_snapshot_cents`**, frozen at log time,
and a selection spanning two rates produces two lines. A resolved rate of zero bills as a zero-cent
line that still shows the work.

**Nothing is billed twice, under a re-run or a race.** The stamp is a conditional update predicated
on `invoiced_in_id IS NULL` whose returned row count must equal the plan; a shortfall rolls the
whole transaction back, invoice included.

## Consequences

### Positive

- A grouped line never carries a provenance claim that is false, and the two column families stay
  independently trustworthy.
- Every refusal names its reason, so a freelancer is told what to do instead of receiving a number
  that quietly means something else.
- The double-billing defence is one statement rather than a read-then-write, so it holds without
  explicit locking.

### Negative

- Grouping by task or project loses per-line traceability back to individual entries; only
  `invoiced_in_id` answers that afterwards.
- A freelancer billing two clients or two currencies at once must repeat the action per client and
  per currency.
- Very short entries have to be merged or edited before they can be billed at all.

## Alternatives considered

### Name an arbitrary source row on a grouped line

Rejected: the column would then mean "one of the rows this line came from", which no reader could
distinguish from "the row this line came from", and any later consumer joining through it would
under-count.

### Forbid grouping so provenance is always complete

Rejected: one line per entry is the correct default and is offered, but a month of ten-minute
entries produces an invoice a client cannot read, and the README has promised grouping by project or
task since the beginning.

### Convert across currencies using `invoices.exchange_rate`

Rejected: the column exists to snapshot a rate, and no rate source exists in the instance. Inventing
one would put a number on a client's invoice that the freelancer never agreed to.

### Round time to the quarter hour

Rejected: it is a billing policy, not an arithmetic detail. It needs a setting and a client
agreement, and applying it silently would over-charge every short entry.

### Re-resolve the hourly rate at conversion time

Rejected: it contradicts the snapshot semantics recorded at the top of
`database/schema/lineItems.ts` and would re-price finished work whenever a project or client rate
changed afterwards.

### Route the retainer branch through the new conversion service

Rejected: its line is an aggregate over the pool overage and its in-pool hours are billed by a
separate fee line, so it would gain no provenance it is allowed to write, and the job would take a
dependency on the invoice conversion module for no behavioural change.
