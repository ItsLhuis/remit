import { type ReportCell, type ReportResult, type ReportRow } from "./reportTable"

// The printed page's geometry, in CSS pixels at 96 dpi — A4 portrait is 794 x 1123 there. The same
// two numbers reach `page.pdf` through `ReportDocument`, because Chromium honours the CSS page box
// over the print settings when the two disagree and the mismatch shows up as a hairline extra page
// (`features/templates/services/documentShell.ts` records the same trap).
export const REPORT_PAGE_WIDTH_PX = 794
export const REPORT_PAGE_HEIGHT_PX = 1123
export const REPORT_PAGE_MARGIN_PX = 40
export const REPORT_INTRO_HEIGHT_PX = 132
export const REPORT_TABLE_HEADER_HEIGHT_PX = 28
export const REPORT_FOOTER_HEIGHT_PX = 24
export const REPORT_ROW_HEIGHT_PX = 26
export const REPORT_GROUP_HEIGHT_PX = 30
export const REPORT_TOTALS_HEIGHT_PX = 30

export type ReportDocumentItem =
  | { kind: "group"; currency: string }
  | { kind: "row"; currency: string; row: ReportRow }
  | { kind: "totals"; currency: string; cells: ReportCell[] }

// The grouped result flattened into the exact sequence the printed table prints, so pagination has
// one list to measure rather than a nested structure to walk twice. It is the printed counterpart of
// `toReportTableRows`, and it keeps each currency's own total row attached to the rows it sums —
// totals are never combined across currencies (`reportTable.ts`).
export function toReportDocumentItems(result: ReportResult): ReportDocumentItem[] {
  return result.groups.flatMap((group) => [
    { kind: "group" as const, currency: group.currency },
    ...group.rows.map((row) => ({ kind: "row" as const, currency: group.currency, row })),
    { kind: "totals" as const, currency: group.currency, cells: group.totals }
  ])
}

export function getReportItemHeight(item: ReportDocumentItem): number {
  if (item.kind === "group") return REPORT_GROUP_HEIGHT_PX
  if (item.kind === "totals") return REPORT_TOTALS_HEIGHT_PX

  return REPORT_ROW_HEIGHT_PX
}

export function getReportBodyHeight(page: number): number {
  const content = REPORT_PAGE_HEIGHT_PX - 2 * REPORT_PAGE_MARGIN_PX - REPORT_FOOTER_HEIGHT_PX
  const body = content - REPORT_TABLE_HEADER_HEIGHT_PX

  return page === 0 ? body - REPORT_INTRO_HEIGHT_PX : body
}

// Pagination is computed here rather than left to the browser, and that is the load-bearing decision
// of this document. `renderHtmlToPdf` exposes no header or footer template, so "page 3 of 7" cannot
// be produced by Chromium's own paging — and CSS paged media offers no page counter Chromium
// implements. Measuring the rows in a pure function instead yields the page numbers, the repeated
// table header and the guarantee that no row is ever split, all from one place a test can assert
// without a browser.
//
// The price is that every row occupies exactly `REPORT_ROW_HEIGHT_PX`; the document's CSS clamps a
// wrapping label to two lines inside that height rather than letting it push the page taller.
export function paginateReportDocumentItems(
  items: readonly ReportDocumentItem[]
): ReportDocumentItem[][] {
  if (items.length === 0) return [[]]

  const pages: ReportDocumentItem[][] = []

  let current: ReportDocumentItem[] = []
  let used = 0

  for (const item of items) {
    if (current.length > 0 && used + getRequiredHeight(item) > getReportBodyHeight(pages.length)) {
      pages.push(current)

      current = []
      used = 0
    }

    current.push(item)
    used += getReportItemHeight(item)
  }

  pages.push(current)

  return pages
}

// A currency heading claims the space of its first row as well as its own, so a heading that would
// land at the foot of a page moves to the next one with its rows. A heading alone above a page break
// announces rows that appear overleaf, which reads as an empty group.
function getRequiredHeight(item: ReportDocumentItem): number {
  const height = getReportItemHeight(item)

  return item.kind === "group" ? height + REPORT_ROW_HEIGHT_PX : height
}
