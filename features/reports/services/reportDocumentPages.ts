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
export const REPORT_LINE_HEIGHT_PX = 13
export const REPORT_ROW_BORDER_PX = 1
export const REPORT_CELL_PADDING_PX = 8
export const REPORT_TEXT_FONT_PX = 11

const REPORT_CONTENT_WIDTH_PX = REPORT_PAGE_WIDTH_PX - 2 * REPORT_PAGE_MARGIN_PX

// The table's default split: the row label, its detail, and the figure columns sharing the rest.
const LABEL_PERCENT = 24
const DETAIL_PERCENT = 12
const MIN_LABEL_PERCENT = 14
const COMFORTABLE_MIN_FIGURE_FONT_PX = 7

// Every advance below is an upper bound in em, not an average, because underestimating a width is
// the failure this layout exists to prevent: a figure that does not fit loses a digit and a label
// that wraps onto an unmeasured line is clipped. Overestimating costs only a slightly smaller figure
// or a slightly taller row. The figures print in a monospace face (0.6em in every local family the
// renderer may pick); the labels in the system sans, classed by glyph width.
const MONOSPACE_ADVANCE_EM = 0.62
const SPACE_ADVANCE_EM = 0.3

export type ReportColumnLayout = {
  labelPercent: number
  detailPercent: number
  // The share of one figure column; every figure column has the same.
  figurePercent: number
  figureFontPx: number
}

export type ReportDocumentItem =
  | { kind: "group"; currency: string }
  | { kind: "row"; currency: string; row: ReportRow; heightPx: number }
  | { kind: "totals"; currency: string; cells: ReportCell[] }

// A figure never loses a digit. It keeps the base size when it fits; otherwise it shrinks, down to
// the smallest size that still reads comfortably on paper; then its columns widen at the row
// label's expense, because a label wraps onto a taller row and a figure cannot; and only when the
// label is already at its narrowest does the figure shrink further, to whatever fits. Decided from
// the widest figure the document prints, so every figure column shares one size and the table
// keeps its vertical rhythm.
export function layoutReportColumns(
  figureColumnCount: number,
  widestFigureLength: number
): ReportColumnLayout {
  const columns = Math.max(figureColumnCount, 1)
  const baseFontPx = columns >= 5 ? 10 : 11

  const figurePercentFor = (labelPercent: number): number =>
    (100 - labelPercent - DETAIL_PERCENT) / columns
  const fittingFont = (labelPercent: number): number =>
    fitFigureFont(
      (figurePercentFor(labelPercent) / 100) * REPORT_CONTENT_WIDTH_PX,
      widestFigureLength
    )

  const atBase = fittingFont(LABEL_PERCENT)

  if (atBase >= COMFORTABLE_MIN_FIGURE_FONT_PX) {
    return {
      labelPercent: LABEL_PERCENT,
      detailPercent: DETAIL_PERCENT,
      figurePercent: figurePercentFor(LABEL_PERCENT),
      figureFontPx: Math.min(baseFontPx, atBase)
    }
  }

  const neededFigurePx =
    widestFigureLength * COMFORTABLE_MIN_FIGURE_FONT_PX * MONOSPACE_ADVANCE_EM +
    REPORT_CELL_PADDING_PX
  const neededLabelPercent =
    100 - DETAIL_PERCENT - ((neededFigurePx * columns) / REPORT_CONTENT_WIDTH_PX) * 100
  const labelPercent = Math.max(MIN_LABEL_PERCENT, Math.min(LABEL_PERCENT, neededLabelPercent))

  return {
    labelPercent,
    detailPercent: DETAIL_PERCENT,
    figurePercent: figurePercentFor(labelPercent),
    figureFontPx: Math.min(COMFORTABLE_MIN_FIGURE_FONT_PX, fittingFont(labelPercent))
  }
}

// How many lines `text` takes when the browser wraps it greedily at word boundaries into `widthPx`,
// breaking a word wider than the line anywhere (the document's `overflow-wrap: anywhere`).
export function estimateWrappedLines(text: string, widthPx: number, fontPx: number): number {
  const lineWidth = widthPx / fontPx
  const words = text.split(/\s+/).filter((word) => word.length > 0)

  if (words.length === 0) return 1

  let lines = 1
  let used = 0

  for (const word of words) {
    const wordWidth = measureEm(word)
    const spaced = used === 0 ? wordWidth : used + SPACE_ADVANCE_EM + wordWidth

    if (spaced <= lineWidth) {
      used = spaced

      continue
    }

    if (used > 0) lines += 1

    used = 0

    for (const character of word) {
      const advance = getCharacterAdvanceEm(character)

      if (used > 0 && used + advance > lineWidth) {
        lines += 1
        used = 0
      }

      used += advance
    }
  }

  return lines
}

// A row is as tall as its taller wrapped cell, and never shorter than the base row the page was
// designed around. Pagination measures with this same number and the document's CSS prints it, so
// no row is clipped and none is split across a page.
export function getReportRowHeight(row: ReportRow, layout: ReportColumnLayout): number {
  const labelLines = estimateWrappedLines(
    row.label,
    getTextColumnWidthPx(layout.labelPercent),
    REPORT_TEXT_FONT_PX
  )
  const detailLines = row.sublabel
    ? estimateWrappedLines(
        row.sublabel,
        getTextColumnWidthPx(layout.detailPercent),
        REPORT_TEXT_FONT_PX
      )
    : 1

  const lines = Math.max(labelLines, detailLines)

  // The row's own bottom border sits inside the height the browser gives it, so the wrapped lines
  // need one pixel more than they measure; without it the last line loses its descenders.
  return Math.max(REPORT_ROW_HEIGHT_PX, lines * REPORT_LINE_HEIGHT_PX + REPORT_ROW_BORDER_PX)
}

// The grouped result flattened into the exact sequence the printed table prints, so pagination has
// one list to measure rather than a nested structure to walk twice. It is the printed counterpart of
// `toReportTableRows`, and it keeps each currency's own total row attached to the rows it sums —
// totals are never combined across currencies (`reportTable.ts`).
export function toReportDocumentItems(
  result: ReportResult,
  layout: ReportColumnLayout
): ReportDocumentItem[] {
  return result.groups.flatMap((group) => [
    { kind: "group" as const, currency: group.currency },
    ...group.rows.map((row) => ({
      kind: "row" as const,
      currency: group.currency,
      row,
      heightPx: getReportRowHeight(row, layout)
    })),
    { kind: "totals" as const, currency: group.currency, cells: group.totals }
  ])
}

export function getReportItemHeight(item: ReportDocumentItem): number {
  if (item.kind === "group") return REPORT_GROUP_HEIGHT_PX
  if (item.kind === "totals") return REPORT_TOTALS_HEIGHT_PX

  return item.heightPx
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
// The price is that a row's height must be known before the browser lays it out, which is why
// `getReportRowHeight` estimates its wrapped lines from conservative glyph widths and the document
// prints each row at exactly that height.
export function paginateReportDocumentItems(
  items: readonly ReportDocumentItem[]
): ReportDocumentItem[][] {
  if (items.length === 0) return [[]]

  const pages: ReportDocumentItem[][] = []

  let current: ReportDocumentItem[] = []
  let used = 0

  for (const [index, item] of items.entries()) {
    const required = getRequiredHeight(item, items[index + 1])

    if (current.length > 0 && used + required > getReportBodyHeight(pages.length)) {
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
function getRequiredHeight(item: ReportDocumentItem, next: ReportDocumentItem | undefined): number {
  const height = getReportItemHeight(item)

  return item.kind === "group" && next ? height + getReportItemHeight(next) : height
}

function getCharacterAdvanceEm(character: string): number {
  if ("MW@%&".includes(character)) return 1
  if ("mw".includes(character)) return 0.9
  if ("iIjlt!|.,:;'`fr()[]".includes(character)) return 0.35
  if (/[0-9]/.test(character)) return 0.6
  if (/[A-Z]/.test(character)) return 0.75
  if (/[a-z]/.test(character)) return 0.6

  // Anything outside ASCII — accented Latin, Greek, Cyrillic, and the full-width CJK and emoji
  // glyphs that take a whole em — counts as one em, the widest any of them gets.
  return character.charCodeAt(0) > 0x7f ? 1 : 0.75
}

function measureEm(text: string): number {
  let width = 0

  for (const character of text) width += getCharacterAdvanceEm(character)

  return width
}

function getTextColumnWidthPx(percent: number): number {
  return (percent / 100) * REPORT_CONTENT_WIDTH_PX - REPORT_CELL_PADDING_PX
}

// The largest size, in half pixels, at which a figure of `length` characters fits `columnWidthPx`.
function fitFigureFont(columnWidthPx: number, length: number): number {
  const available = columnWidthPx - REPORT_CELL_PADDING_PX

  return Math.floor((available / (Math.max(length, 1) * MONOSPACE_ADVANCE_EM)) * 2) / 2
}
