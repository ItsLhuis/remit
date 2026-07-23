export type OutstandingInvoiceStatus = "draft" | "sent" | "paid"

export type OutstandingInvoiceInput = {
  status: OutstandingInvoiceStatus
  totalCents: number
  paidCents: number
}

export const OUTSTANDING_INVOICE_STATUSES = ["sent", "paid"] as const

const OUTSTANDING_STATUS_SET = new Set<OutstandingInvoiceStatus>(OUTSTANDING_INVOICE_STATUSES)

export function isOutstandingInvoiceStatus(status: OutstandingInvoiceStatus): boolean {
  return OUTSTANDING_STATUS_SET.has(status)
}

// Paid invoices stay in the sum on purpose: a fully paid invoice nets to zero, while a partially
// paid one that was later marked paid still contributes its unpaid remainder. Drafts are excluded
// because they are not yet owed. The clamp keeps an overpaid client at zero outstanding rather
// than reporting a negative balance the UI has no meaning for.
export function calculateOutstandingBalanceCents(
  invoices: readonly OutstandingInvoiceInput[]
): number {
  let totalCents = 0
  let paidCents = 0

  for (const invoice of invoices) {
    assertIntegerCents(invoice.totalCents)
    assertIntegerCents(invoice.paidCents)

    if (!isOutstandingInvoiceStatus(invoice.status)) continue

    totalCents += invoice.totalCents
    paidCents += invoice.paidCents
  }

  return Math.max(totalCents - paidCents, 0)
}

function assertIntegerCents(value: number): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error("Money values must be safe integer cents")
  }
}
