# ADR-0044: One outstanding amount, credit notes settle an invoice, and a late fee re-renders its PDF

- **Status:** Accepted
- **Date:** 2026-09-24

## Context

What an invoice still owes was computed two ways. The owner's invoice screen, the credit-note
editor, the client portal, the dashboard and the revenue report subtracted the credit notes issued
against the invoice; the public invoice page, hosted checkout, "mark as paid", the invoice and
client lists, the invoice and reminder emails, the late-fee base, the `invoice.amountDue` merge
variable, the public API and the MCP tools did not. A client opening a credited invoice was quoted
two amounts, and the card path charged the larger.

Settlement counted payments only: an invoice was paid when its payments reached its total. A credit
note never moves `total_cents` ([ADR-0033](0033-late-fee-placement.md) keeps the total as the issued
document stated it), so an invoice credited and then paid for its remainder stayed `sent` for ever —
it went overdue, drew reminders for money nobody owed, could be charged a late fee on that phantom
balance, and "mark as paid" would record a payment for the part already credited.

Separately, a late fee changes `total_cents` of an issued invoice after its PDF was rendered at
send, and the PDF is never re-rendered, so every reminder and receipt attached a document stating a
total the invoice no longer had.

## Decision

**One definition.** `features/invoices/services/invoiceStatusView.ts`'s `getInvoiceOutstandingCents`
is the total less the live credit notes less the payments, clamped at zero per invoice. The late fee
is already inside the total and is not added again. Every surface that computes, shows, charges or
exposes what an invoice owes calls it, and the reads that sort, filter or aggregate on it in SQL
restate it in one place each (`features/invoices/queryFragments.ts`,
`features/clients/queryFragments.ts`), each pinned to the function by an integration test.

**Credit notes settle an invoice.** The owner decided this when the two definitions were reconciled:
`features/payments/services/paymentSettlement.ts` settles an invoice exactly when that outstanding
amount reaches zero on a positive total, so payments and credit notes together close it, and an
invoice credited in full with nothing paid reads as paid. Issuing, withdrawing or restoring a credit
note re-decides settlement inside the same transaction and under the invoice lock payments already
take (`paymentWrites.ts`'s `resettleInvoiceWrite`), and a data migration settled the invoices
already covered before the rule existed.

**The overpayment bound stays at the total.** Credits do not lower what a payment may bring the
aggregate to. A client may pay the original amount before seeing a credit note, or a card payment
may land after a credit note was issued while its Checkout Session was open; that money arrived, and
a recorder that refused it would leave Remit disagreeing with the bank. What is then owed back is a
refund, outside this model.

**Checkout charges the outstanding amount**, so a credited invoice is charged its credited balance.
The idempotency key keeps its shape from [ADR-0032](0032-card-payment-recording-authority.md): it
includes the amount, so a credit note that changes the balance opens a new session instead of
replaying one priced for the old balance.

**A late fee supersedes the stored PDF.** Charging or adjusting a fee clears
`invoices.pdf_upload_id` in the same statement and enqueues a render, so the document every later
reminder and receipt attaches states the invoice's current total and prints the fee. The superseded
object stays in storage: the client already holds it as the copy they were sent. Nothing else
re-renders an issued invoice.

## Consequences

### Positive

- The invoice page, the portal, checkout, the reminders, the API and the MCP tools quote one amount
  for one invoice, and the card is never charged more than the client was shown.
- An invoice that owes nothing stops being overdue, reminded or charged a late fee.
- A client asked for a late fee receives a document that shows it.

### Negative

- A fully credited invoice reads `paid` with no payment recorded; the credit notes beside it are
  what say how it was settled.
- A client who paid the original total after a credit note was issued is left overpaid relative to
  what they owed, and nothing in Remit records the refund.
- Each fee change leaves the previous PDF object in storage with no row pointing at it, the case the
  orphan-sweep question already covers.

## Alternatives considered

### Keep settlement payment-only

Making every amount credit-aware while leaving settlement alone would have made hosted checkout
charge the credited balance and then left the invoice partly paid for ever, since the payment could
never reach the total. It was rejected because the stuck state would become the normal card path.

### Reduce `total_cents` or `amount_paid_cents` when a credit note is issued

Either would have let the old payment-only rule settle a credited invoice. It was rejected because
the total is what the issued document stated, and `amount_paid_cents` is the sum of the payment rows
(`paymentWrites.ts`); a stored figure that silently drifted from either would make the PDF, the
audit trail and the payment history disagree with the row behind them.

### Lower the overpayment bound to the credited balance

It would have refused a payment that took the aggregate past the credited balance. It was rejected
because the refused money would already be in the owner's account, and a card payment refused by the
recorder is money taken that Remit never shows.
