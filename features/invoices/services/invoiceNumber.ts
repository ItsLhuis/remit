export type InvoiceNumberInput = {
  prefix: string
  paddingWidth: number
  nextSequence: number
}

// A number wider than the configured padding is never truncated — `INV-` at width 4 yields
// `INV-0042` but still yields `INV-100000` once the counter outgrows the pad. Truncating would mint
// a duplicate against the `invoices.number` unique index, and an invoice number is permanent.
export function generateInvoiceNumber({
  prefix,
  paddingWidth,
  nextSequence
}: InvoiceNumberInput): string {
  return `${prefix}${String(nextSequence).padStart(paddingWidth, "0")}`
}
