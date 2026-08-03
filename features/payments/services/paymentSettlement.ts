export type InvoiceSettlementInput = {
  amountPaidCents: number
  totalCents: number
}

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
// credit note (Stage 19), never an aggregate that runs past the total.
//
// A zero-total invoice reads as `unpaid` rather than `settled`. It is unreachable from a payment
// write — every payment is `> 0` (`chk_payments_amount`), so the first one against a zero total is
// already `overpaid` — and calling it settled would let a document nobody has paid claim it was.
export function evaluateInvoiceSettlement({
  amountPaidCents,
  totalCents
}: InvoiceSettlementInput): InvoiceSettlement {
  if (amountPaidCents > totalCents) {
    return { outcome: "overpaid", excessCents: amountPaidCents - totalCents }
  }

  if (totalCents > 0 && amountPaidCents === totalCents) return { outcome: "settled" }

  if (amountPaidCents > 0) return { outcome: "partial" }

  return { outcome: "unpaid" }
}

export function sumPaymentAmountCents(payments: ReadonlyArray<{ amountCents: number }>): number {
  return payments.reduce((total, payment) => total + payment.amountCents, 0)
}
