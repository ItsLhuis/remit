import { describe, expect, test } from "vitest"

import { serializeCsv } from "@/lib/utils"

import { buildReportCsvRows, type ReportCsvHeaders } from "../buildReportCsvRows"
import { toReportResult, type ReportBucket, type ReportColumnId } from "../reportTable"

const COLUMNS: ReportColumnId[] = ["invoiceCount", "invoiced"]

const HEADERS: ReportCsvHeaders = {
  label: "Client",
  sublabel: "Detail",
  currency: "Currency",
  columns: ["Invoices", "Invoiced"],
  total: "Total"
}

function makeBucket(overrides: Partial<ReportBucket> = {}): ReportBucket {
  return {
    key: "client-a",
    label: "Client A",
    sublabel: null,
    currency: "EUR",
    cells: [
      { kind: "count", value: 1 },
      { kind: "money", cents: 123_450 }
    ],
    ...overrides
  }
}

describe("buildReportCsvRows", () => {
  test("writes only a header row when there is nothing to report", () => {
    const rows = buildReportCsvRows(toReportResult(COLUMNS, []), HEADERS)

    expect(rows).toEqual([["Client", "Detail", "Currency", "Invoices", "Invoiced"]])
  })

  test("writes money as a plain decimal with the currency in its own column", () => {
    const rows = buildReportCsvRows(toReportResult(COLUMNS, [makeBucket()]), HEADERS)

    expect(rows[1]).toEqual(["Client A", "", "EUR", "1", "1234.50"])
  })

  test("writes a duration as decimal hours", () => {
    const rows = buildReportCsvRows(
      toReportResult(
        ["entryCount", "hours"],
        [
          makeBucket({
            cells: [
              { kind: "count", value: 1 },
              { kind: "duration", seconds: 5400 }
            ]
          })
        ]
      ),
      { ...HEADERS, columns: ["Entries", "Hours"] }
    )

    expect(rows[1]).toEqual(["Client A", "", "EUR", "1", "1.50"])
  })

  test("closes each currency with its own total row and never a combined one", () => {
    const rows = buildReportCsvRows(
      toReportResult(COLUMNS, [
        makeBucket({
          currency: "EUR",
          cells: [
            { kind: "count", value: 1 },
            { kind: "money", cents: 10_000 }
          ]
        }),
        makeBucket({
          currency: "USD",
          cells: [
            { kind: "count", value: 1 },
            { kind: "money", cents: 40_000 }
          ]
        })
      ]),
      HEADERS
    )

    expect(rows.filter((row) => row[0] === "Total")).toEqual([
      ["Total", "", "USD", "1", "400.00"],
      ["Total", "", "EUR", "1", "100.00"]
    ])
  })

  // The escaping itself belongs to `serializeCsv` and is round-tripped against an RFC 4180 reader in
  // lib/utils/__tests__/csv.test.ts. What this pins is that the builder hands the helper raw values
  // and never pre-escapes or pre-formats them, which is the mistake that would defeat it.
  test("leaves a hostile label for the shared serializer to quote and neutralize", () => {
    const rows = buildReportCsvRows(
      toReportResult(COLUMNS, [makeBucket({ label: '=HYPERLINK("x"),Ltd' })]),
      HEADERS
    )

    expect(rows[1]?.[0]).toBe('=HYPERLINK("x"),Ltd')
    expect(serializeCsv([rows[1] ?? []])).toBe(`"'=HYPERLINK(""x""),Ltd",,EUR,1,1234.50`)
  })
})
