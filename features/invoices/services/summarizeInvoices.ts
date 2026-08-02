import { type InvoiceStatus } from "../schemas"

import { deriveInvoiceStatusView, getInvoiceOutstandingCents } from "./invoiceStatusView"

export type InvoiceSummaryInput = {
  status: InvoiceStatus
  currency: string
  totalCents: number
  amountPaidCents: number
  dueDate: Date | null
  paidAt: Date | null
}

export type InvoiceOutstandingValue = {
  currency: string
  totalCents: number
}

export type InvoicesSummaryResult = {
  total: number
  draft: number
  awaiting: number
  overdue: number
  paid: number
  outstandingByCurrency: InvoiceOutstandingValue[]
  hasSingleCurrency: boolean
}

// `awaiting` counts every issued-but-unsettled invoice, overdue ones included: they are all money
// the freelancer is still owed, and `overdue` is the sharper cut of the same population rather than
// a disjoint bucket.
//
// Outstanding value is bucketed per currency rather than summed: a project may price in any
// currency and Remit holds no exchange rates, so a single total would be a number that means
// nothing.
export function summarizeInvoices(
  invoices: readonly InvoiceSummaryInput[],
  now: Date
): InvoicesSummaryResult {
  const outstandingTotals = new Map<string, number>()

  let draft = 0
  let awaiting = 0
  let overdue = 0
  let paid = 0

  for (const invoice of invoices) {
    const view = deriveInvoiceStatusView(invoice, now)

    if (invoice.status === "draft") draft += 1
    if (invoice.status === "paid") paid += 1
    if (view === "overdue") overdue += 1

    if (invoice.status !== "draft" && invoice.status !== "paid") {
      awaiting += 1
      outstandingTotals.set(
        invoice.currency,
        (outstandingTotals.get(invoice.currency) ?? 0) + getInvoiceOutstandingCents(invoice)
      )
    }
  }

  const outstandingByCurrency = Array.from(outstandingTotals.entries())
    .map(([currency, totalCents]) => ({ currency, totalCents }))
    .sort((first, second) => second.totalCents - first.totalCents)

  return {
    total: invoices.length,
    draft,
    awaiting,
    overdue,
    paid,
    outstandingByCurrency,
    hasSingleCurrency: outstandingByCurrency.length <= 1
  }
}
