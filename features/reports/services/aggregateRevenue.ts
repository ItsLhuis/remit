import { getInvoiceOutstandingCents } from "@/features/invoices/services"

import {
  toReportResult,
  type ReportColumnId,
  type ReportResult,
  type ReportRowOrder
} from "./reportTable"

// One issued invoice, already reduced to the dimension the report groups by. The label and sublabel
// are resolved by the caller rather than here, so this file stays arithmetic and the three revenue
// reports (client, project, month) differ only in what they put in `key`.
export type RevenueReportRow = {
  key: string
  label: string
  sublabel: string | null
  currency: string
  totalCents: number
  creditedCents: number
  amountPaidCents: number
}

export const REVENUE_REPORT_COLUMNS: ReportColumnId[] = [
  "invoiceCount",
  "invoiced",
  "credited",
  "netRevenue",
  "paid",
  "outstanding"
]

// Accrual, not cash: the population is the invoices that were issued, because a credit note and a
// tax rate exist only on an invoice and never on a payment. `paid` is the cash column beside it, so
// a reader can see both without the report having to pick one basis.
//
// `outstanding` is `getInvoiceOutstandingCents`, clamped per invoice before it is summed. Summing
// unclamped balances would let one over-paid invoice cancel out another client's genuine debt inside
// the same bucket.
export function aggregateRevenue(
  rows: readonly RevenueReportRow[],
  order: ReportRowOrder = "value"
): ReportResult {
  return toReportResult(
    REVENUE_REPORT_COLUMNS,
    rows.map((row) => {
      const netCents = row.totalCents - row.creditedCents

      return {
        key: row.key,
        label: row.label,
        sublabel: row.sublabel,
        currency: row.currency,
        cells: [
          { kind: "count" as const, value: 1 },
          { kind: "money" as const, cents: row.totalCents },
          { kind: "money" as const, cents: row.creditedCents },
          { kind: "money" as const, cents: netCents },
          { kind: "money" as const, cents: row.amountPaidCents },
          { kind: "money" as const, cents: getInvoiceOutstandingCents(row) }
        ]
      }
    }),
    order
  )
}
