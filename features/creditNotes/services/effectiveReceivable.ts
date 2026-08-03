export type CreditedInvoice = {
  totalCents: number
  amountPaidCents: number
}

// What a credit note does to the invoice it adjusts, expressed as a derivation rather than a write.
//
// An invoice's `total_cents` is never rewritten when a credit note is issued against it: the
// document the client received said what it said, and a stored total that silently drifted would
// make every historical figure — the PDF, the public view, the audit trail — disagree with the row
// behind it. What changes is the amount still collectible, and that is computed here from the
// invoice's own total plus the credit notes standing against it.
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

// The effective receivable less what has already been collected. This is what the invoice surface
// prints as still owed, and it is a distinct clamp from the one above: an invoice credited below
// what the client already paid leaves nothing outstanding, not a negative balance to chase.
export function computeInvoiceOutstandingAfterCredits(
  invoice: CreditedInvoice,
  creditNoteTotalsCents: readonly number[]
): number {
  const effectiveReceivable = computeInvoiceEffectiveReceivable(
    invoice.totalCents,
    creditNoteTotalsCents
  )

  return Math.max(effectiveReceivable - invoice.amountPaidCents, 0)
}
