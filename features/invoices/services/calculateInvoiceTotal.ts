export type InvoiceDiscount =
  | { type: "percentage"; percentage: number }
  | { type: "fixed"; amountCents: number }

export type InvoiceLineItemInput = {
  quantity: number
  unitPriceCents: number
  discount: InvoiceDiscount | null
  taxPercentage: number
}

export type InvoiceLineTotals = {
  subtotalCents: number
  taxAmountCents: number
  totalCents: number
}

export type InvoiceTotals = {
  subtotalCents: number
  discountAmountTotalCents: number
  taxAmountCents: number
  totalCents: number
}

type AllocatedLine = {
  grossCents: number
  discountCents: number
  netCents: number
  taxPercentage: number
  documentDiscountShareCents: number
  taxableCents: number
  taxAmountCents: number
}

type Allocation = {
  lines: AllocatedLine[]
  subtotalCents: number
  lineDiscountTotalCents: number
  documentDiscountCents: number
  taxAmountCents: number
}

// Duplicated from features/proposals/services/calculateProposalTotal.ts rather than imported: an
// invoice is a legally distinct document whose arithmetic must not shift when the proposal side is
// changed, and reaching across a feature boundary for it is forbidden either way (architecture.md).
// The two must agree today, which is why a proposal converted to an invoice re-prices through this
// function and the integration test asserts the totals match.
//
// Discount precedence, in the order the money is reduced:
//
//   1. gross      = round(quantity × unitPriceCents)             — the line before any discount
//   2. line       = percentage → round(gross × pct/100)
//                   fixed      → min(amountCents, gross)          — a fixed discount never inverts a line
//   3. net        = gross − line discount
//   4. document   = percentage → round(Σ net × pct/100)
//                   fixed      → min(amountCents, Σ net)          — applied to the post-line-discount net,
//                                                                   never to the gross, so the two discount
//                                                                   levels compound rather than stack
//   5. taxable_i  = net_i − the line's share of the document discount
//   6. tax        = Σ round(taxable_i × taxPercentage_i / 100)
//
// Step 5 is what makes mixed tax rates correct: a document-level discount has to reduce the taxable
// base of each line in proportion to that line, otherwise a 10%-taxed line and a 23%-taxed line
// would both be taxed on their undiscounted amount and the total would over-collect tax.
export function calculateInvoiceTotal(
  lineItems: InvoiceLineItemInput[],
  invoiceDiscount?: InvoiceDiscount | null
): InvoiceTotals {
  const allocation = allocate(lineItems, invoiceDiscount ?? null)

  const discountAmountTotalCents =
    allocation.lineDiscountTotalCents + allocation.documentDiscountCents

  return {
    subtotalCents: allocation.subtotalCents,
    discountAmountTotalCents,
    taxAmountCents: allocation.taxAmountCents,
    totalCents: allocation.subtotalCents - discountAmountTotalCents + allocation.taxAmountCents
  }
}

// The persisted `line_items` columns. `totalCents` is taxable + tax rather than net + tax, so the
// lines sum exactly to the invoice's `totalCents` even when a document discount is present.
export function calculateInvoiceLineTotals(
  lineItems: InvoiceLineItemInput[],
  invoiceDiscount?: InvoiceDiscount | null
): InvoiceLineTotals[] {
  return allocate(lineItems, invoiceDiscount ?? null).lines.map((line) => ({
    subtotalCents: line.netCents,
    taxAmountCents: line.taxAmountCents,
    totalCents: line.taxableCents + line.taxAmountCents
  }))
}

function allocate(lineItems: InvoiceLineItemInput[], discount: InvoiceDiscount | null): Allocation {
  const lines = lineItems.map((item) => {
    const grossCents = Math.round(item.quantity * item.unitPriceCents)
    const discountCents = applyDiscount(grossCents, item.discount)

    return {
      grossCents,
      discountCents,
      netCents: grossCents - discountCents,
      taxPercentage: item.taxPercentage
    }
  })

  const subtotalCents = lines.reduce((total, line) => total + line.grossCents, 0)
  const lineDiscountTotalCents = lines.reduce((total, line) => total + line.discountCents, 0)
  const netTotalCents = subtotalCents - lineDiscountTotalCents

  const documentDiscountCents = applyDiscount(netTotalCents, discount)
  const shares = allocateShares(
    lines.map((line) => line.netCents),
    documentDiscountCents
  )

  const allocated = lines.map((line, index) => {
    const documentDiscountShareCents = shares[index] ?? 0
    const taxableCents = line.netCents - documentDiscountShareCents

    return {
      ...line,
      documentDiscountShareCents,
      taxableCents,
      taxAmountCents: Math.round((taxableCents * line.taxPercentage) / 100)
    }
  })

  return {
    lines: allocated,
    subtotalCents,
    lineDiscountTotalCents,
    documentDiscountCents,
    taxAmountCents: allocated.reduce((total, line) => total + line.taxAmountCents, 0)
  }
}

function applyDiscount(baseCents: number, discount: InvoiceDiscount | null): number {
  if (!discount) return 0

  if (discount.type === "percentage") return Math.round((baseCents * discount.percentage) / 100)

  return Math.min(discount.amountCents, baseCents)
}

// Largest-remainder allocation. Flooring every share and stopping there would leave the document
// discount short by up to one cent per line, so the shortfall is handed out one cent at a time to
// the lines with the largest dropped fraction; ties fall to the earlier line, which keeps the split
// deterministic for a given set of lines.
function allocateShares(weights: number[], amountCents: number): number[] {
  const totalWeight = weights.reduce((total, weight) => total + weight, 0)

  if (amountCents === 0 || totalWeight === 0) return weights.map(() => 0)

  const exact = weights.map((weight) => (weight * amountCents) / totalWeight)
  const shares = exact.map((value) => Math.floor(value))

  const remainderOrder = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)

  let leftover = amountCents - shares.reduce((total, share) => total + share, 0)

  for (const { index } of remainderOrder) {
    if (leftover <= 0) break

    shares[index] = (shares[index] ?? 0) + 1
    leftover -= 1
  }

  return shares
}
