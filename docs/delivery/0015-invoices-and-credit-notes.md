# DR-0015: Invoices, public view and credit notes

- **Status:** Shipped
- **Date:** 2026-08-03
- **Verdict:** Complete with known gaps
- **Decisions:** ADR-0009, ADR-0017
- **Supersedes:** —
- **Reconstructed:** yes

## What

Invoices with line items, discounts, tax and a computed status; an anonymous public page where a
client reads one; and credit notes issued against an invoice with their own numbering.

## Why

The invoice is the document the whole product exists to produce. It also has the least forgiving
arithmetic in the system: a rounding error in a tax calculation is a legal problem, not a display
bug. Credit notes exist because Portuguese and EU law require a correction to an issued invoice to
be its own numbered document rather than an edit.

## Scope

Included: invoices created manually or converted from an accepted proposal; line items with per-item
discount and tax; document-level discount as a percentage or a fixed amount; multi-currency with an
exchange rate snapshot; the Draft → Sent → Paid → Overdue lifecycle with a computed `partially_paid`
view; due-date arithmetic and reminder scheduling data; the public tokenised page at `/i/[token]`;
the instance-wide invoice list; and credit notes with their own sequence, discount handling and
effective-receivable arithmetic.

Excluded: editing an issued invoice. A correction is a credit note. Also excluded: a stored
`partially_paid` status — it is derived at read time from the payments against the invoice, because
storing it would give two places the same truth and let them disagree.

## How

Money is integer minor units everywhere, per ADR-0009, and `bigint` columns are converted with
`Number(...)` at the query boundary so services and the UI work in cents. Rounding happens in the
pure total services with `Math.round`, once, rather than per line at the call sites.

Line items are polymorphic across invoices, proposals, credit notes and contracts through
mutually-exclusive parent foreign keys per ADR-0017, so one calculation engine serves every
document.

`invoiceStatusView.ts` derives the displayed status, including `partially_paid`, from the invoice
and its payments. That derivation is a service rather than SQL so the badge and the read model
cannot drift.

The public page uses the same constant-time comparison, timing-safe miss and `noindex` headers as
the proposal and contract routes, and `proxy.ts` drops `X-Frame-Options` on it deliberately so a
client can embed the invoice.

## Evidence

- `features/invoices/` — `publicView.ts`, `publicQueries.ts`, `overviewQueries.ts`,
  `documentData.ts`, `conversion.ts`, `invoiceWrites.ts`, `systemWrites.ts`
- `features/invoices/services/calculateInvoiceTotal.ts`, `invoiceDiscount.ts`, `invoiceDates.ts`,
  `invoiceNumber.ts`, `invoiceReminders.ts`, `invoiceStatusView.ts`, `canTransitionInvoiceStatus.ts`
- `features/creditNotes/services/calculateCreditNoteTotal.ts`, `creditNoteDiscount.ts`,
  `creditNoteNumber.ts`, `effectiveReceivable.ts`
- `database/schema/invoices.ts`, `database/schema/creditNotes.ts`, `database/schema/lineItems.ts`
- `app/(public)/i/[token]/`, `app/(dashboard)/invoices/`, `app/(dashboard)/credit-notes/`
- `docs/architecture/adr/0009-money-as-integer-minor-units.md`

## Verification

Eight invoice service test files and five credit-note ones cover totals, discounts, dates,
numbering, reminder scheduling, the status derivation and the effective receivable, including the
draft and partial-payment boundary cases. Integration tests cover the mutations, the overview query,
the public read and the document data build.
`app/(public)/i/[token]/__tests__/publicInvoiceRoute.test.tsx` covers the public page.

Not covered by an end-to-end test: the invoice lifecycle from creation to paid in a browser. It is
covered at the integration layer.

## Known gaps

`invoices.late_fee_cents` is read by the render data and the export manifest and written by nothing
— not by the application and not by the seeder — so the automatic late-fee logic `README.md`
describes does not exist.

`line_items.source_time_entry_id` and `source_expense_id` are written only by the demo seeder; no
application path converts unbilled time or re-billable expenses into an invoice.

Card payment on the public invoice page is deliberately inert and says so in the component; there is
no checkout producer for the Stripe webhook that already consumes one.
