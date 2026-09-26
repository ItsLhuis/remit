import { getInvoiceOutstandingCents } from "@/features/invoices/services"

export type OutstandingInvoiceStatus = "draft" | "sent" | "paid"

export type OutstandingInvoiceInput = {
  status: OutstandingInvoiceStatus
  totalCents: number
  paidCents: number
  creditedCents: number
}

export const OUTSTANDING_INVOICE_STATUSES = ["sent", "paid"] as const

const OUTSTANDING_STATUS_SET = new Set<OutstandingInvoiceStatus>(OUTSTANDING_INVOICE_STATUSES)

export function isOutstandingInvoiceStatus(status: OutstandingInvoiceStatus): boolean {
  return OUTSTANDING_STATUS_SET.has(status)
}

// Paid invoices stay in the sum on purpose: a fully paid invoice nets to zero, while a partially
// paid one that was later marked paid still contributes its unpaid remainder. Drafts are excluded
// because they are not yet owed.
//
// Each invoice contributes `getInvoiceOutstandingCents` — the one definition, credit notes netted and
// clamped per invoice — so an invoice paid or credited beyond its total adds nothing rather than
// hiding what another invoice of the same client still owes. `queryFragments.ts`'s
// `getClientOutstandingSubquery` is the SQL form of this sum and must stay equal to it.
export function calculateOutstandingBalanceCents(
  invoices: readonly OutstandingInvoiceInput[]
): number {
  let outstandingCents = 0

  for (const invoice of invoices) {
    assertIntegerCents(invoice.totalCents)
    assertIntegerCents(invoice.paidCents)
    assertIntegerCents(invoice.creditedCents)

    if (!isOutstandingInvoiceStatus(invoice.status)) continue

    outstandingCents += getInvoiceOutstandingCents({
      totalCents: invoice.totalCents,
      amountPaidCents: invoice.paidCents,
      creditedCents: invoice.creditedCents
    })
  }

  return outstandingCents
}

function assertIntegerCents(value: number): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error("Money values must be safe integer cents")
  }
}
