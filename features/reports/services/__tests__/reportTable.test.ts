import { describe, expect, test } from "vitest"

import {
  countReportRows,
  toReportResult,
  toReportTableRows,
  type ReportBucket,
  type ReportColumnId
} from "../reportTable"

const COLUMNS: ReportColumnId[] = ["invoiceCount", "invoiced"]

function makeBucket(overrides: Partial<ReportBucket> = {}): ReportBucket {
  return {
    key: "client-a",
    label: "Client A",
    sublabel: null,
    currency: "EUR",
    cells: [
      { kind: "count", value: 1 },
      { kind: "money", cents: 10_000 }
    ],
    ...overrides
  }
}

describe("toReportResult", () => {
  test("returns no groups when there is nothing to report", () => {
    const result = toReportResult(COLUMNS, [])

    expect(result.groups).toEqual([])
    expect(countReportRows(result)).toBe(0)
  })

  test("merges buckets that share a key within one currency", () => {
    const result = toReportResult(COLUMNS, [makeBucket(), makeBucket()])

    expect(result.groups).toHaveLength(1)
    expect(result.groups[0]?.rows).toHaveLength(1)
    expect(result.groups[0]?.rows[0]?.cells).toEqual([
      { kind: "count", value: 2 },
      { kind: "money", cents: 20_000 }
    ])
  })

  test("keeps the same dimension in separate groups when its currencies differ", () => {
    const result = toReportResult(COLUMNS, [
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
          { kind: "money", cents: 30_000 }
        ]
      })
    ])

    expect(result.groups.map((group) => group.currency)).toEqual(["USD", "EUR"])
    expect(result.groups.every((group) => group.rows.length === 1)).toBe(true)
    expect(result.groups.map((group) => group.totals[1])).toEqual([
      { kind: "money", cents: 30_000 },
      { kind: "money", cents: 10_000 }
    ])
  })

  test("totals only the rows of its own currency", () => {
    const result = toReportResult(COLUMNS, [
      makeBucket({ key: "a", currency: "EUR" }),
      makeBucket({ key: "b", currency: "EUR" }),
      makeBucket({ key: "c", currency: "GBP" })
    ])

    const euro = result.groups.find((group) => group.currency === "EUR")

    expect(euro?.totals).toEqual([
      { kind: "count", value: 2 },
      { kind: "money", cents: 20_000 }
    ])
  })

  test("ranks rows by their first money column when the dimension has no order", () => {
    const result = toReportResult(COLUMNS, [
      makeBucket({
        key: "small",
        label: "Small",
        cells: [
          { kind: "count", value: 1 },
          { kind: "money", cents: 100 }
        ]
      }),
      makeBucket({
        key: "large",
        label: "Large",
        cells: [
          { kind: "count", value: 1 },
          { kind: "money", cents: 900 }
        ]
      })
    ])

    expect(result.groups[0]?.rows.map((row) => row.key)).toEqual(["large", "small"])
  })

  test("orders rows by key when the dimension is itself ordered", () => {
    const result = toReportResult(
      COLUMNS,
      [
        makeBucket({
          key: "2026-03",
          label: "Mar 2026",
          cells: [
            { kind: "count", value: 1 },
            { kind: "money", cents: 900 }
          ]
        }),
        makeBucket({
          key: "2026-01",
          label: "Jan 2026",
          cells: [
            { kind: "count", value: 1 },
            { kind: "money", cents: 100 }
          ]
        })
      ],
      "key"
    )

    expect(result.groups[0]?.rows.map((row) => row.key)).toEqual(["2026-01", "2026-03"])
  })

  test("falls back to the label when the report carries no money column to rank by", () => {
    const result = toReportResult(
      ["entryCount", "hours"],
      [
        makeBucket({
          key: "b",
          label: "Beta",
          cells: [
            { kind: "count", value: 1 },
            { kind: "duration", seconds: 60 }
          ]
        }),
        makeBucket({
          key: "a",
          label: "Alpha",
          cells: [
            { kind: "count", value: 1 },
            { kind: "duration", seconds: 900 }
          ]
        })
      ]
    )

    expect(result.groups[0]?.rows.map((row) => row.label)).toEqual(["Alpha", "Beta"])
  })

  test("ranks a money-free report's currencies by how many rows each holds", () => {
    const result = toReportResult(
      ["entryCount"],
      [
        makeBucket({ key: "a", currency: "EUR", cells: [{ kind: "count", value: 1 }] }),
        makeBucket({ key: "a", currency: "USD", cells: [{ kind: "count", value: 1 }] }),
        makeBucket({ key: "b", currency: "USD", cells: [{ kind: "count", value: 1 }] })
      ]
    )

    expect(result.groups.map((group) => group.currency)).toEqual(["USD", "EUR"])
  })

  test("breaks a tie between two equal currencies on the currency code", () => {
    const result = toReportResult(COLUMNS, [
      makeBucket({ currency: "USD" }),
      makeBucket({ currency: "EUR" })
    ])

    expect(result.groups.map((group) => group.currency)).toEqual(["EUR", "USD"])
  })

  test("breaks a tie between two equal rows on the label", () => {
    const result = toReportResult(COLUMNS, [
      makeBucket({ key: "b", label: "Beta" }),
      makeBucket({ key: "a", label: "Alpha" })
    ])

    expect(result.groups[0]?.rows.map((row) => row.label)).toEqual(["Alpha", "Beta"])
  })

  test("reads a row shorter than the column list as a zero rather than dropping it", () => {
    const result = toReportResult(COLUMNS, [
      makeBucket({ key: "short", label: "Short", cells: [{ kind: "count", value: 1 }] }),
      makeBucket({ key: "full", label: "Full" })
    ])

    expect(result.groups[0]?.rows.map((row) => row.key)).toEqual(["full", "short"])
  })

  test("flattens groups into table rows that each carry their own currency", () => {
    const result = toReportResult(COLUMNS, [
      makeBucket({ key: "a", currency: "EUR" }),
      makeBucket({ key: "a", currency: "USD" })
    ])

    expect(toReportTableRows(result).map((row) => [row.key, row.currency])).toEqual(
      expect.arrayContaining([
        ["a", "EUR"],
        ["a", "USD"]
      ])
    )
  })

  test("flattens an empty report into no table rows", () => {
    expect(toReportTableRows(toReportResult(COLUMNS, []))).toEqual([])
  })

  test("sums durations without converting them to another cell kind", () => {
    const result = toReportResult(
      ["entryCount", "hours"],
      [
        makeBucket({
          cells: [
            { kind: "count", value: 1 },
            { kind: "duration", seconds: 3600 }
          ]
        }),
        makeBucket({
          cells: [
            { kind: "count", value: 1 },
            { kind: "duration", seconds: 1800 }
          ]
        })
      ]
    )

    expect(result.groups[0]?.totals[1]).toEqual({ kind: "duration", seconds: 5400 })
  })
})
