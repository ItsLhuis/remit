# DR-0035: Billing time and expenses onto an invoice

- **Status:** Shipped
- **Date:** 2026-09-05
- **Verdict:** Complete with known gaps
- **Decisions:** ADR-0007, ADR-0009, ADR-0017, ADR-0026, ADR-0031
- **Supersedes:** —

## What

Unbilled billable time entries and re-billable expenses are selected on the lists they already live
on and become line items on a new draft invoice or on an existing one, priced from the rate each
entry was logged at.

## Why

Every ingredient of this flow shipped and none of them were joined. `time_entries.invoiced_in_id`,
`expenses.invoiced_in_id`, `line_items.source_time_entry_id`, `line_items.source_expense_id`, the
two unbilled partial indexes, the rate-precedence service and the expense markup column all existed,
and the only path that wrote any of them was the recurring retainer branch. A freelancer could track
an hour and record a re-billable cost against a project, and then had no way to charge either — the
largest hole in the money lifecycle the README describes, and the reason
`.agents/rules/testing.md`'s third canonical end-to-end flow had no spec.

## Scope

Included: the reads that find unbilled work by id, the pure service that groups and prices it, the
server action that writes the invoice and stamps the source rows in one transaction, the selection
and preview surface on both list pages, and the canonical end-to-end flow.

Excluded, with reasons:

- **Grouping expenses.** One line per expense, always. An expense carries its own description,
  category, receipt and markup, and merging two destroys what the client needs to check the charge.
- **Rounding time to the quarter hour.** A billing policy needing a setting and a client agreement,
  not an arithmetic detail (ADR-0031).
- **Billing across currencies or clients.** Refused rather than converted or split; no exchange-rate
  source exists and ADR-0026 admits one client per document.
- **Changing the recurring retainer branch.** Its aggregate overage line is already correct under
  the provenance rule this record ships, so routing it through the new service would change no
  behaviour.
- **A "bill everything unbilled for this project" shortcut.** The selection is the input; a bulk
  shortcut is a separate surface decision.

## How

The whole rule set — grouping, rounding, rate splitting, the markup description, the currency and
client checks, and the mapping to a line shape — is one pure function, `planBillableConversion`. It
runs twice: once in the browser to price the preview, and once inside the action's transaction
against rows read there. Only the second decides. That is why the sheet can show a total before
anything is written without the preview ever being the thing that bills.

Three parts of the write are not obvious from reading it:

- **The plan is re-derived inside the transaction, and the stamp is a second gate.** The
  pre-transaction read exists only to refuse an impossible selection with a message that names the
  reason before a number is claimed. The stamp is a conditional
  `UPDATE ... WHERE invoiced_in_id IS NULL ... RETURNING id` whose row count must equal the plan, so
  a concurrent conversion either committed first (the predicate re-evaluates against the new row
  version and excludes the row) or is still open (this statement blocks on its row lock and then
  sees the same thing). Either way the count falls short and the whole transaction rolls back,
  invoice included.
- **Appending to a draft rewrites every line's totals, not just the new ones.** A document-level
  discount is shared across lines by largest-remainder allocation, so adding a line moves the share,
  taxable base and tax of every line already there. The existing lines are re-derived from their own
  stored quantity, unit price, discount and tax snapshot — never re-read from a tax rate or a source
  row — so the redistribution never re-prices anything.
- **Provenance is asymmetric on purpose.** A line drawn from one row names it; a grouped line names
  nothing, and `invoiced_in_id` remains the complete answer for every row. ADR-0031 records why, and
  why the recurring retainer branch already complies rather than being an exception.

Neither list page needed a new selection mechanism: both already disabled row selection for invoiced
and deleted rows and both already rendered a bulk action bar, so the change is one more button and a
sheet.

## Evidence

- Pure rule: `features/invoices/services/billableConversion.ts` — `planBillableConversion`,
  `resolveSelectionScope`, `toTimeLineDraft:239` (single-source provenance),
  `toExpenseLineDraft:257` (always-present provenance).
- Write: `features/invoices/billing.ts` — `confirmPlan:170` (in-transaction re-derivation),
  `stampBilled:364` with the conditional predicates at `:373` and `:385`.
- Append arithmetic: `features/invoices/invoiceWrites.ts` — `appendInvoiceLineItems`.
- Reads: `features/timeTracking/queries.ts` `listUnbilledTimeEntries`,
  `features/expenses/queries.ts` `listUnbilledExpenses`, `features/invoices/queries.ts`
  `listBillableTargetInvoices`.
- Surface: `features/invoices/components/BillableWorkSheet/`, wired into
  `features/timeTracking/components/TimeTrackingPage/TimeTrackingPage.tsx` and
  `features/expenses/components/ExpensesListPage/ExpensesListPage.tsx`.
- Decision: [ADR-0031](../architecture/adr/0031-billing-conversion-provenance.md).
- No schema change: the columns, indexes and constraints this uses all predate it, so no migration
  was generated.

## Verification

- `features/invoices/services/__tests__/billableConversion.test.ts` — 23 unit tests over the money
  edges: sum-then-round versus round-then-sum, the hundredth-of-an-hour boundary in both directions,
  an entry too short to bill, a zero resolved rate, two rates in one group, markup present and
  absent, and both refusals.
- `features/invoices/__tests__/billing.integration.test.ts` — 14 tests against real Postgres,
  including the sequential re-run (`:446`) and the race (`:489`). The race test is deterministic: it
  holds the settings row in a second transaction so the conversion parks at `claimInvoiceNumber`
  after it has already read the entry as unbilled, stamps the entry from outside, then releases.
  Removing the `invoiced_in_id IS NULL` predicate from `stampBilled` was confirmed to fail it.
- `features/invoices/components/BillableWorkSheet/__tests__/BillableWorkSheet.test.tsx` — five
  component tests including `vitest-axe` over the dialog content.
- `tests/e2e/timeToInvoice.spec.ts` — `.agents/rules/testing.md`'s canonical flow 3, end to end.
- Gates run: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:integration`, `pnpm build`,
  react-doctor and fallow.

Not covered: no test asserts the produced PDF or the email body carries the converted lines — the
E2E flow sends the invoice and asserts the status transition, and the render itself is DR-0023's
coverage.

## Known gaps

- A selection spanning two clients or two currencies is refused rather than split, so billing a
  month of work across several clients is several actions.
- There is no "bill everything unbilled on this project" shortcut; the selection is always explicit.
- A converted line takes the instance default tax rate. An instance whose clients need different
  rates has to change the rate on the draft afterwards.
- Time entries too short to round to a hundredth of an hour cannot be billed at all and are reported
  rather than merged.
- The append path recomputes every line's totals in one statement; an invoice with a very large
  number of lines has not been measured.
