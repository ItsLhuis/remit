export type CreditNoteDiscount =
  | { type: "percentage"; percentage: number }
  | { type: "fixed"; amountCents: number }

export type CreditNoteLineItemInput = {
  quantity: number
  unitPriceCents: number
  discount: CreditNoteDiscount | null
  taxPercentage: number
}

export type CreditNoteLineTotals = {
  subtotalCents: number
  taxAmountCents: number
  totalCents: number
}

export type CreditNoteTotals = {
  subtotalCents: number
  taxAmountCents: number
  totalCents: number
}

type AllocatedLine = {
  netCents: number
  taxAmountCents: number
}

// The credit-note arithmetic, deliberately one level simpler than
// features/invoices/services/calculateInvoiceTotal.ts, and duplicated rather than imported for the
// same reason that one is: a credit note is a legally distinct document whose figures must not move
// when the invoice side is changed, and reaching across a feature boundary is forbidden anyway
// (architecture.md).
//
// The difference that matters is the meaning of `subtotalCents`. An invoice records its discount in
// its own `discount_amount_total_cents` column, so its subtotal is the gross and the total is
// subtotal − discount + tax. `credit_notes` has no discount column — only subtotal, tax and total,
// all constrained `>= 0` by `chk_credit_notes_totals` — so the subtotal here is already NET of line
// discounts and the identity is exactly `total = subtotal + tax`. A gross subtotal would leave the
// discount unrepresentable in the stored row.
//
// There is no document-level discount for the same reason: the table has nowhere to record one, and
// a credit note that needs to be smaller is simply written for a smaller amount.
//
//   1. gross = round(quantity × unitPriceCents)
//   2. line  = percentage → round(gross × pct/100)
//              fixed      → min(amountCents, gross)   — a fixed discount never inverts a line
//   3. net   = gross − line discount
//   4. tax   = round(net × taxPercentage / 100)
export function calculateCreditNoteTotal(lineItems: CreditNoteLineItemInput[]): CreditNoteTotals {
  const lines = allocate(lineItems)

  const subtotalCents = lines.reduce((total, line) => total + line.netCents, 0)
  const taxAmountCents = lines.reduce((total, line) => total + line.taxAmountCents, 0)

  return { subtotalCents, taxAmountCents, totalCents: subtotalCents + taxAmountCents }
}

// The persisted `line_items` columns. Every line's total is its own net plus its own tax, so the
// lines sum exactly to the credit note's `total_cents`.
export function calculateCreditNoteLineTotals(
  lineItems: CreditNoteLineItemInput[]
): CreditNoteLineTotals[] {
  return allocate(lineItems).map((line) => ({
    subtotalCents: line.netCents,
    taxAmountCents: line.taxAmountCents,
    totalCents: line.netCents + line.taxAmountCents
  }))
}

function allocate(lineItems: CreditNoteLineItemInput[]): AllocatedLine[] {
  return lineItems.map((item) => {
    const grossCents = Math.round(item.quantity * item.unitPriceCents)
    const netCents = grossCents - applyDiscount(grossCents, item.discount)

    return { netCents, taxAmountCents: Math.round((netCents * item.taxPercentage) / 100) }
  })
}

function applyDiscount(baseCents: number, discount: CreditNoteDiscount | null): number {
  if (!discount) return 0

  if (discount.type === "percentage") return Math.round((baseCents * discount.percentage) / 100)

  return Math.min(discount.amountCents, baseCents)
}
