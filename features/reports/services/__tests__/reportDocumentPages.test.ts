import { describe, expect, test } from "vitest"

import {
  getReportBodyHeight,
  getReportItemHeight,
  paginateReportDocumentItems,
  toReportDocumentItems,
  type ReportDocumentItem
} from "../reportDocumentPages"
import { toReportResult, type ReportBucket, type ReportColumnId } from "../reportTable"

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

function makeRows(count: number, currency = "EUR"): ReportDocumentItem[] {
  return toReportDocumentItems(
    toReportResult(
      COLUMNS,
      Array.from({ length: count }, (_, index) =>
        makeBucket({ key: `client-${index}`, label: `Client ${index}`, currency })
      )
    )
  )
}

function countRows(page: readonly ReportDocumentItem[]): number {
  return page.filter((item) => item.kind === "row").length
}

describe("toReportDocumentItems", () => {
  test("prints each currency as a heading, its rows, then its own total", () => {
    const items = toReportDocumentItems(
      toReportResult(COLUMNS, [makeBucket(), makeBucket({ key: "b", currency: "USD" })])
    )

    expect(items.map((item) => item.kind)).toEqual([
      "group",
      "row",
      "totals",
      "group",
      "row",
      "totals"
    ])
  })
})

describe("paginateReportDocumentItems", () => {
  test("returns one empty page when the report has no rows", () => {
    expect(paginateReportDocumentItems([])).toEqual([[]])
  })

  test("keeps every row when the report spans several pages", () => {
    const items = makeRows(120)

    const pages = paginateReportDocumentItems(items)

    expect(pages.length).toBeGreaterThan(1)
    expect(pages.flat()).toHaveLength(items.length)
  })

  test("fits fewer rows on the first page because the document header sits above them", () => {
    const pages = paginateReportDocumentItems(makeRows(120))

    expect(countRows(pages[0] ?? [])).toBeLessThan(countRows(pages[1] ?? []))
  })

  test("never fills a page beyond the height its rows were measured against", () => {
    const pages = paginateReportDocumentItems(makeRows(200))

    for (const [index, page] of pages.entries()) {
      const used = page.reduce((total, item) => total + getReportItemHeight(item), 0)

      expect(used).toBeLessThanOrEqual(getReportBodyHeight(index))
    }
  })

  test("moves a currency heading to the page its rows are on", () => {
    const pages = paginateReportDocumentItems([
      ...makeRows(60, "EUR"),
      ...makeRows(60, "USD").map((item) => ({ ...item, currency: "USD" }))
    ])

    for (const page of pages) {
      expect(page[page.length - 1]?.kind).not.toBe("group")
    }
  })
})
