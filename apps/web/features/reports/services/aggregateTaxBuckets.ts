import { toReportResult, type ReportColumnId, type ReportResult } from "./reportTable"

// One tax bucket of one document, already split into its taxable base and its tax. Both reports
// below read the same population, which is what makes their totals reconcile with each other and
// with the invoices they came from.
//
// The taxable base is `line_items.total_cents - line_items.tax_amount_cents`, never the line's own
// `subtotal_cents`: `calculateInvoiceLineTotals` in features/invoices/services/calculateInvoiceTotal.ts
// writes `total` as taxable + tax while `subtotal` is the pre-document-discount net, so only the
// former sums to the invoice's `total_cents` when a document-level discount is present.
export type TaxReportRow = {
  key: string
  label: string
  sublabel: string | null
  currency: string
  taxableCents: number
  taxCents: number
  creditedTaxableCents: number
  creditedTaxCents: number
}

export const REVENUE_BY_TAX_RATE_COLUMNS: ReportColumnId[] = ["netTaxable", "netTax", "netGross"]

export const TAX_SUMMARY_COLUMNS: ReportColumnId[] = [
  "taxableBase",
  "taxAmount",
  "creditedTaxable",
  "creditedTax",
  "netTaxDue"
]

// Revenue seen through the tax rate that was charged on it, net of credit notes — what was actually
// earned at each rate rather than what was owed to the tax authority.
export function aggregateRevenueByTaxRate(rows: readonly TaxReportRow[]): ReportResult {
  return toReportResult(
    REVENUE_BY_TAX_RATE_COLUMNS,
    rows.map((row) => {
      const netTaxableCents = row.taxableCents - row.creditedTaxableCents
      const netTaxCents = row.taxCents - row.creditedTaxCents

      return {
        key: row.key,
        label: row.label,
        sublabel: row.sublabel,
        currency: row.currency,
        cells: [
          { kind: "money" as const, cents: netTaxableCents },
          { kind: "money" as const, cents: netTaxCents },
          { kind: "money" as const, cents: netTaxableCents + netTaxCents }
        ]
      }
    })
  )
}

// The liability view of the same rows: gross charged, gross credited, and the difference that is
// still owed. Kept as separate columns rather than a single net figure because a tax return is filed
// on both sides, and a reader checking a period against their filing needs to see the credit.
export function aggregateTaxSummary(rows: readonly TaxReportRow[]): ReportResult {
  return toReportResult(
    TAX_SUMMARY_COLUMNS,
    rows.map((row) => ({
      key: row.key,
      label: row.label,
      sublabel: row.sublabel,
      currency: row.currency,
      cells: [
        { kind: "money" as const, cents: row.taxableCents },
        { kind: "money" as const, cents: row.taxCents },
        { kind: "money" as const, cents: row.creditedTaxableCents },
        { kind: "money" as const, cents: row.creditedTaxCents },
        { kind: "money" as const, cents: row.taxCents - row.creditedTaxCents }
      ]
    }))
  )
}
