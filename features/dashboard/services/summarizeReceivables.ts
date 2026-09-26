import { getInvoiceOutstandingCents } from "@/features/invoices/services"

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

// Each invoice's receivable is `getInvoiceOutstandingCents`, clamped per invoice before it is summed
// so an over-credited or over-paid invoice cannot drag another invoice's balance down with it.
//
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
    const receivableCents = getInvoiceOutstandingCents(row)

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
