// What a credit note does to the invoice it adjusts, expressed as a derivation rather than a write.
//
// An invoice's `total_cents` is never rewritten when a credit note is issued against it: the
// document the client received said what it said, and a stored total that silently drifted would
// make every historical figure — the PDF, the public view, the audit trail — disagree with the row
// behind it. What changes is the amount still collectible, and that is computed here from the
// invoice's own total plus the credit notes standing against it. What is still owed after payments
// is `features/invoices/services/invoiceStatusView.ts`'s `getInvoiceOutstandingCents`, the one
// definition every surface reads.
//
// Floored at zero throughout: over-crediting an invoice is a bookkeeping decision the freelancer is
// allowed to make, but "the client owes minus forty euros" is not a receivable, and a negative
// figure rendered as money due reads as a defect.
export function sumCreditNoteTotalCents(creditNoteTotalsCents: readonly number[]): number {
  return creditNoteTotalsCents.reduce((total, value) => total + value, 0)
}

export function computeInvoiceEffectiveReceivable(
  invoiceTotalCents: number,
  creditNoteTotalsCents: readonly number[]
): number {
  return Math.max(invoiceTotalCents - sumCreditNoteTotalCents(creditNoteTotalsCents), 0)
}
