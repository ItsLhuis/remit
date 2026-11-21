import {
  getInvoiceOutstandingCents,
  type InvoiceOutstandingInput
} from "@/features/invoices/services"

// Re-exported so the payment write paths reach the one outstanding definition through their own
// services barrel; a server module may not import another feature's services directly.
export { getInvoiceOutstandingCents }

export type InvoiceSettlementInput = InvoiceOutstandingInput

export type InvoiceSettlement =
  | { outcome: "unpaid" }
  | { outcome: "partial" }
  | { outcome: "settled" }
  | { outcome: "overpaid"; excessCents: number }

// The one place the aggregate is turned into a decision, so the write path, the read models and the
// tests cannot disagree about what a given (paid, total) pair means.
//
// `overpaid` is a rejection rather than a state the database is allowed to hold: `chk_invoices_
// amount_paid` bounds `amount_paid_cents` at `total_cents`, and reducing what a client owes is a
// credit note (`features/creditNotes`), never an aggregate that runs past the total.
//
// Credit notes count toward settlement: an invoice is settled exactly when
// `features/invoices/services/invoiceStatusView.ts`'s `getInvoiceOutstandingCents` reaches zero, so
// an invoice whose payments and credit notes together cover its total is paid, and one that still
// owes money is not. Before that rule an invoice credited and then paid for its remainder stayed open
// for ever — overdue, reminded and charged a late fee on money nobody owed.
//
// The overpayment bound stays at the total and ignores credits on purpose. A client may pay the full
// original amount before seeing a credit note, or a card payment may land after a credit note was
// issued while its Checkout Session was open; that money did arrive, and refusing to record it would
// leave the aggregate disagreeing with the bank. What the client is then owed back is a refund, not
// a state this function models.
//
// A zero-total invoice reads as `unpaid` rather than `settled`. It is unreachable from a payment
// write — every payment is `> 0` (`chk_payments_amount`), so the first one against a zero total is
// already `overpaid` — and calling it settled would let a document nobody has paid claim it was.
export function evaluateInvoiceSettlement(invoice: InvoiceSettlementInput): InvoiceSettlement {
  const { amountPaidCents, totalCents } = invoice

  if (amountPaidCents > totalCents) {
    return { outcome: "overpaid", excessCents: amountPaidCents - totalCents }
  }

  if (totalCents > 0 && getInvoiceOutstandingCents(invoice) === 0) return { outcome: "settled" }

  if (amountPaidCents > 0) return { outcome: "partial" }

  return { outcome: "unpaid" }
}

export function sumPaymentAmountCents(payments: ReadonlyArray<{ amountCents: number }>): number {
  return payments.reduce((total, payment) => total + payment.amountCents, 0)
}
