import { describe, expect, test } from "vitest"

import {
  aggregateRevenueByTaxRate,
  aggregateTaxSummary,
  type TaxReportRow
} from "../aggregateTaxBuckets"
import { getCellValue } from "../reportTable"

// One EUR invoice of two lines — 100 000 at 23% and 50 000 at 10% — plus a credit note that gives
// back 10 000 at 23%. Its persisted columns are `tax_amount_cents` 28 000 and `total_cents` 178 000,
// which is what the reconciliation assertions below check the report against.
const INVOICE_TAX_AMOUNT_CENTS = 28_000
const INVOICE_TOTAL_CENTS = 178_000

function makeRow(overrides: Partial<TaxReportRow> = {}): TaxReportRow {
  return {
    key: "rate-standard:23",
    label: "Standard",
    sublabel: "23%",
    currency: "EUR",
    taxableCents: 0,
    taxCents: 0,
    creditedTaxableCents: 0,
    creditedTaxCents: 0,
    ...overrides
  }
}

function makeSampleInvoiceRows(): TaxReportRow[] {
  return [
    makeRow({ taxableCents: 100_000, taxCents: 23_000 }),
    makeRow({
      key: "rate-reduced:10",
      label: "Reduced",
      sublabel: "10%",
      taxableCents: 50_000,
      taxCents: 5_000
    }),
    makeRow({ creditedTaxableCents: 10_000, creditedTaxCents: 2_300 })
  ]
}

describe("aggregateTaxSummary", () => {
  test("returns nothing when no invoice was issued", () => {
    expect(aggregateTaxSummary([]).groups).toEqual([])
  })

  test("reports charged, credited and net tax per rate for a hand-checked invoice", () => {
    const result = aggregateTaxSummary(makeSampleInvoiceRows())
    const rows = result.groups[0]?.rows ?? []

    expect(rows.find((row) => row.key === "rate-standard:23")?.cells).toEqual([
      { kind: "money", cents: 100_000 },
      { kind: "money", cents: 23_000 },
      { kind: "money", cents: 10_000 },
      { kind: "money", cents: 2_300 },
      { kind: "money", cents: 20_700 }
    ])
    expect(rows.find((row) => row.key === "rate-reduced:10")?.cells).toEqual([
      { kind: "money", cents: 50_000 },
      { kind: "money", cents: 5_000 },
      { kind: "money", cents: 0 },
      { kind: "money", cents: 0 },
      { kind: "money", cents: 5_000 }
    ])
  })

  test("reconciles to the invoice's own tax and total columns to the cent", () => {
    const totals = aggregateTaxSummary(makeSampleInvoiceRows()).groups[0]?.totals ?? []

    const taxableBaseCents = getCellValue(totals[0] ?? { kind: "count", value: 0 })
    const taxAmountCents = getCellValue(totals[1] ?? { kind: "count", value: 0 })

    expect(taxAmountCents).toBe(INVOICE_TAX_AMOUNT_CENTS)
    expect(taxableBaseCents + taxAmountCents).toBe(INVOICE_TOTAL_CENTS)
  })

  test("splits one tax rate into two rows when its snapshot percentage changed between invoices", () => {
    const result = aggregateTaxSummary([
      makeRow({
        key: "rate-standard:23",
        sublabel: "23%",
        taxableCents: 100_000,
        taxCents: 23_000
      }),
      makeRow({ key: "rate-standard:21", sublabel: "21%", taxableCents: 100_000, taxCents: 21_000 })
    ])

    expect(result.groups[0]?.rows).toHaveLength(2)
    expect(result.groups[0]?.totals[1]).toEqual({ kind: "money", cents: 44_000 })
  })

  test("keeps two currencies in separate groups rather than combining their tax", () => {
    const result = aggregateTaxSummary([
      makeRow({ currency: "EUR", taxableCents: 100_000, taxCents: 23_000 }),
      makeRow({ currency: "USD", taxableCents: 100_000, taxCents: 8_000 })
    ])

    expect(result.groups).toHaveLength(2)
    expect(result.groups.map((group) => group.totals[1])).toEqual(
      expect.arrayContaining([
        { kind: "money", cents: 23_000 },
        { kind: "money", cents: 8_000 }
      ])
    )
  })
})

describe("aggregateRevenueByTaxRate", () => {
  test("nets credit notes out of both the taxable base and the tax", () => {
    const result = aggregateRevenueByTaxRate(makeSampleInvoiceRows())
    const standard = result.groups[0]?.rows.find((row) => row.key === "rate-standard:23")

    expect(standard?.cells).toEqual([
      { kind: "money", cents: 90_000 },
      { kind: "money", cents: 20_700 },
      { kind: "money", cents: 110_700 }
    ])
  })

  test("shows a rate that was only ever credited as a negative row rather than dropping it", () => {
    const result = aggregateRevenueByTaxRate([
      makeRow({ creditedTaxableCents: 10_000, creditedTaxCents: 2_300 })
    ])

    expect(result.groups[0]?.rows[0]?.cells).toEqual([
      { kind: "money", cents: -10_000 },
      { kind: "money", cents: -2_300 },
      { kind: "money", cents: -12_300 }
    ])
  })
})
