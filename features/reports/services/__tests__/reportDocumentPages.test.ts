import { describe, expect, test } from "vitest"

import {
  estimateWrappedLines,
  getReportBodyHeight,
  getReportItemHeight,
  getReportRowHeight,
  layoutReportColumns,
  paginateReportDocumentItems,
  REPORT_LINE_HEIGHT_PX,
  REPORT_ROW_BORDER_PX,
  REPORT_ROW_HEIGHT_PX,
  toReportDocumentItems,
  type ReportDocumentItem
} from "../reportDocumentPages"
import { toReportResult, type ReportBucket, type ReportColumnId } from "../reportTable"

const COLUMNS: ReportColumnId[] = ["invoiceCount", "invoiced"]

const LAYOUT = layoutReportColumns(COLUMNS.length, 10)

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
    ),
    LAYOUT
  )
}

function countRows(page: readonly ReportDocumentItem[]): number {
  return page.filter((item) => item.kind === "row").length
}

describe("toReportDocumentItems", () => {
  test("prints each currency as a heading, its rows, then its own total", () => {
    const items = toReportDocumentItems(
      toReportResult(COLUMNS, [makeBucket(), makeBucket({ key: "b", currency: "USD" })]),
      LAYOUT
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

describe("layoutReportColumns", () => {
  test("keeps the base size and split when every figure fits", () => {
    const layout = layoutReportColumns(2, 12)

    expect(layout).toEqual({
      labelPercent: 24,
      detailPercent: 12,
      figurePercent: 32,
      figureFontPx: 11
    })
  })

  test("shrinks the figures before taking width from the label", () => {
    const layout = layoutReportColumns(6, 15)

    expect(layout.labelPercent).toBe(24)
    expect(layout.figureFontPx).toBeLessThan(10)
    expect(layout.figureFontPx).toBeGreaterThanOrEqual(7)
  })

  test("widens the figure columns at the label's expense once shrinking is not enough", () => {
    const layout = layoutReportColumns(6, 22)

    expect(layout.labelPercent).toBeLessThan(24)
    expect(layout.labelPercent).toBeGreaterThanOrEqual(14)
    expect(layout.figurePercent * 6 + layout.labelPercent + layout.detailPercent).toBeCloseTo(100)
  })

  test("always leaves room for every character of the widest figure", () => {
    for (const columns of [1, 2, 4, 6, 8]) {
      for (const length of [4, 12, 18, 24, 32]) {
        const layout = layoutReportColumns(columns, length)
        const columnPx = (layout.figurePercent / 100) * 714

        expect(length * layout.figureFontPx * 0.6 + 8).toBeLessThanOrEqual(columnPx)
      }
    }
  })
})

describe("estimateWrappedLines", () => {
  test("counts one line for text that fits", () => {
    expect(estimateWrappedLines("Aurora Studio", 163, 11)).toBe(1)
  })

  test("wraps a long label onto as many lines as its words need", () => {
    const label = "Northwind Traders International Holdings and Logistics Partners Europe"

    expect(estimateWrappedLines(label, 163, 11)).toBeGreaterThanOrEqual(3)
  })

  test("breaks a single word wider than the column rather than letting it overflow", () => {
    expect(estimateWrappedLines("A".repeat(60), 163, 11)).toBeGreaterThanOrEqual(3)
  })
})

describe("getReportRowHeight", () => {
  test("keeps the base row height for a label of up to two lines", () => {
    const row = { key: "a", label: "Aurora Studio", sublabel: null, cells: [] }

    expect(getReportRowHeight(row, LAYOUT)).toBe(REPORT_ROW_HEIGHT_PX)
  })

  test("grows a row by whole lines, plus its border, for a label that wraps past two", () => {
    const label = "Northwind Traders International Holdings and Logistics Partners Europe Limited"
    const row = { key: "a", label, sublabel: null, cells: [] }

    const height = getReportRowHeight(row, LAYOUT)

    expect(height).toBeGreaterThan(REPORT_ROW_HEIGHT_PX)
    expect((height - REPORT_ROW_BORDER_PX) % REPORT_LINE_HEIGHT_PX).toBe(0)
  })

  test("never splits a tall row across pages and never overfills one", () => {
    const label = "Northwind Traders International Holdings and Logistics Partners Europe Limited"
    const items = toReportDocumentItems(
      toReportResult(
        COLUMNS,
        Array.from({ length: 80 }, (_, index) =>
          makeBucket({ key: `client-${index}`, label: index % 3 === 0 ? label : `Client ${index}` })
        )
      ),
      LAYOUT
    )

    const pages = paginateReportDocumentItems(items)

    expect(pages.flat()).toHaveLength(items.length)

    for (const [index, page] of pages.entries()) {
      const used = page.reduce((total, item) => total + getReportItemHeight(item), 0)

      expect(used).toBeLessThanOrEqual(getReportBodyHeight(index))
    }
  })
})
