import { toCurrencyTotals, type CurrencyTotal } from "./currencyTotals"

export type ReceivableInvoiceRow = {
  currency: string
  totalCents: number
  amountPaidCents: number
  creditedCents: number
  isOverdue: boolean
}

export type ReceivablesSummary = {
  outstanding: CurrencyTotal[]
  outstandingCount: number
  overdue: CurrencyTotal[]
  overdueCount: number
}

// What is still collectable on one invoice, net of the credit notes raised against it. A credit
// note cancels part of an invoice without any money moving, so it belongs here and not in revenue.
// Clamped at zero so an over-credited or over-paid invoice reads as settled instead of dragging
// another invoice's balance down with it — the same clamp as `getInvoiceOutstandingCents` in
// features/invoices/services/invoiceStatusView.ts, which does not know about credit notes.
export function getReceivableCents(
  row: Pick<ReceivableInvoiceRow, "totalCents" | "amountPaidCents" | "creditedCents">
): number {
  return Math.max(row.totalCents - row.amountPaidCents - row.creditedCents, 0)
}

// An invoice whose receivable has reached zero is counted nowhere, in neither the sum nor the
// count: fully credited or fully paid, it is no longer money the freelancer is waiting for, and a
// count that included it would contradict a total of zero sitting beside it. `overdue` is the
// sharper cut of the same population rather than a disjoint bucket, matching how `summarizeInvoices`
// treats awaiting and overdue.
export function summarizeReceivables(rows: readonly ReceivableInvoiceRow[]): ReceivablesSummary {
  const outstanding = new Map<string, number>()
  const overdue = new Map<string, number>()

  let outstandingCount = 0
  let overdueCount = 0

  for (const row of rows) {
    const receivableCents = getReceivableCents(row)

    if (receivableCents === 0) continue

    outstanding.set(row.currency, (outstanding.get(row.currency) ?? 0) + receivableCents)
    outstandingCount += 1

    if (!row.isOverdue) continue

    overdue.set(row.currency, (overdue.get(row.currency) ?? 0) + receivableCents)
    overdueCount += 1
  }

  return {
    outstanding: toCurrencyTotals(outstanding),
    outstandingCount,
    overdue: toCurrencyTotals(overdue),
    overdueCount
  }
}
