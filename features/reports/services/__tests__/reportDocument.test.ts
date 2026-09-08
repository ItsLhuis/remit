import { describe, expect, test } from "vitest"

import {
  buildReportDocument,
  type ReportDocumentInput,
  type ReportDocumentLabels
} from "../reportDocument"
import { toReportResult, type ReportBucket, type ReportColumnId } from "../reportTable"

const COLUMNS: ReportColumnId[] = ["invoiceCount", "invoiced"]

const LABELS: ReportDocumentLabels = {
  title: "Revenue by client",
  business: "Aurora Studio",
  dimension: "Client",
  detail: "Detail",
  total: "Total",
  columns: ["Invoices", "Invoiced"],
  generatedAt: "Generated",
  rows: "Rows",
  rowCount: "2",
  empty: "No rows match these filters",
  page: (page, pages) => `Page ${page} of ${pages}`
}

function makeBucket(overrides: Partial<ReportBucket> = {}): ReportBucket {
  return {
    key: "aurora",
    label: "Aurora",
    sublabel: null,
    currency: "EUR",
    cells: [
      { kind: "count", value: 2 },
      { kind: "money", cents: 123_456 }
    ],
    ...overrides
  }
}

function makeInput(
  buckets: ReportBucket[],
  overrides: Partial<ReportDocumentInput> = {}
): ReportDocumentInput {
  return {
    result: toReportResult(COLUMNS, buckets),
    labels: LABELS,
    filters: [{ label: "Date range", value: "1 Jan 2026 to 31 Mar 2026" }],
    generatedAt: new Date("2026-03-31T10:30:00.000Z"),
    locale: "en",
    timeZone: "UTC",
    ...overrides
  }
}

function countPages(html: string): number {
  return html.split('<section class="page">').length - 1
}

describe("buildReportDocument", () => {
  test("states which report, which filters and when it was generated", () => {
    const { html } = buildReportDocument(makeInput([makeBucket()]))

    expect(html).toContain("Revenue by client")
    expect(html).toContain("Aurora Studio")
    expect(html).toContain("1 Jan 2026 to 31 Mar 2026")
    expect(html).toContain("31 Mar 2026")
    expect(html).toContain("Rows")
  })

  test("prints money in the group currency and duration as decimal hours", () => {
    const { html } = buildReportDocument(
      makeInput([
        makeBucket({
          cells: [
            { kind: "duration", seconds: 5_400 },
            { kind: "money", cents: 123_456 }
          ]
        })
      ])
    )

    expect(html).toContain("1.50")
    expect(html).toContain("€1,234.56")
  })

  test("renders a coherent page rather than a table when nothing matched", () => {
    const { html } = buildReportDocument(makeInput([]))

    expect(countPages(html)).toBe(1)
    expect(html).toContain("No rows match these filters")
    expect(html).not.toContain("<table>")
    expect(html).toContain("Page 1 of 1")
  })

  test("numbers every page and repeats the table header on each", () => {
    const buckets = Array.from({ length: 120 }, (_, index) =>
      makeBucket({ key: `client-${index}`, label: `Client ${index}` })
    )

    const { html } = buildReportDocument(makeInput(buckets))
    const pages = countPages(html)

    expect(pages).toBeGreaterThan(1)
    expect(html.split("<thead>").length - 1).toBe(pages)
    expect(html).toContain(`Page ${pages} of ${pages}`)
  })

  test("escapes a label that would otherwise close the document's own markup", () => {
    const { html } = buildReportDocument(
      makeInput([makeBucket({ label: "</td><script>alert(1)</script>" })])
    )

    expect(html).not.toContain("<script>")
    expect(html).toContain("&lt;script&gt;")
  })

  test("prints the page at the size the renderer is told to print", () => {
    const document = buildReportDocument(makeInput([makeBucket()]))

    expect(document.html).toContain(
      `@page{size:${document.widthPx}px ${document.heightPx}px;margin:0}`
    )
  })
})
