import { escapeHtml, formatDate } from "@/lib/utils"

import { formatReportCell } from "./formatReportCell"
import {
  layoutReportColumns,
  paginateReportDocumentItems,
  REPORT_CELL_PADDING_PX,
  REPORT_FOOTER_HEIGHT_PX,
  REPORT_GROUP_HEIGHT_PX,
  REPORT_INTRO_HEIGHT_PX,
  REPORT_LINE_HEIGHT_PX,
  REPORT_PAGE_HEIGHT_PX,
  REPORT_PAGE_MARGIN_PX,
  REPORT_PAGE_WIDTH_PX,
  REPORT_TABLE_HEADER_HEIGHT_PX,
  REPORT_TEXT_FONT_PX,
  REPORT_TOTALS_HEIGHT_PX,
  toReportDocumentItems,
  type ReportColumnLayout,
  type ReportDocumentItem
} from "./reportDocumentPages"
import { type ReportCell, type ReportResult } from "./reportTable"

// The third consumer `reportTable.ts` anticipated, after the table and the CSV, and the one that
// wants the locale-aware form of a cell rather than the machine-readable one: this document is read
// by a person, on paper, so a figure carries its currency symbol and its thousands separator where
// `buildReportCsvRows` deliberately strips both.
//
// Pure, and handed every string it prints (ADR-0007). Translation, id resolution, and the instance's
// locale and time zone all happen in the caller, so the whole paged layout is assertable from
// arguments alone — without a browser.

export type ReportDocumentFilter = {
  label: string
  value: string
}

export type ReportDocumentLabels = {
  title: string
  business: string | null
  dimension: string
  detail: string
  total: string
  columns: readonly string[]
  generatedAt: string
  rows: string
  rowCount: string
  empty: string
  // A callback rather than a formatted string, because the page count is only known after this
  // service has paginated: the caller keeps the ICU message and this file keeps the arithmetic.
  page: (page: number, pages: number) => string
}

export type ReportDocumentInput = {
  result: ReportResult
  labels: ReportDocumentLabels
  filters: readonly ReportDocumentFilter[]
  generatedAt: Date
  locale: string
  timeZone: string
}

export type ReportDocument = {
  html: string
  widthPx: number
  heightPx: number
}

export function buildReportDocument(input: ReportDocumentInput): ReportDocument {
  const layout = layoutReportColumns(input.labels.columns.length, getWidestFigureLength(input))
  const pages = paginateReportDocumentItems(toReportDocumentItems(input.result, layout))

  const body = pages.map((items, index) => renderPage(input, items, index, pages.length)).join("")

  return {
    html: [
      "<!doctype html>",
      '<html><head><meta charset="utf-8" />',
      `<style>${documentCss(layout)}</style>`,
      "</head><body>",
      body,
      "</body></html>"
    ].join(""),
    widthPx: REPORT_PAGE_WIDTH_PX,
    heightPx: REPORT_PAGE_HEIGHT_PX
  }
}

function renderPage(
  input: ReportDocumentInput,
  items: readonly ReportDocumentItem[],
  index: number,
  pages: number
): string {
  return [
    '<section class="page"><div class="sheet">',
    index === 0 ? renderIntro(input) : "",
    renderTable(input, items),
    renderFooter(input, index, pages),
    "</div></section>"
  ].join("")
}

function renderIntro(input: ReportDocumentInput): string {
  const meta = [
    ...input.filters,
    {
      label: input.labels.generatedAt,
      value: formatDate(input.generatedAt, { locale: input.locale, timeZone: input.timeZone })
    },
    { label: input.labels.rows, value: input.labels.rowCount }
  ]

  return [
    '<header class="intro">',
    `<h1>${escapeHtml(input.labels.title)}</h1>`,
    input.labels.business ? `<p class="business">${escapeHtml(input.labels.business)}</p>` : "",
    '<dl class="meta">',
    meta
      .map(
        (entry) =>
          `<div><dt>${escapeHtml(entry.label)}</dt><dd>${escapeHtml(entry.value)}</dd></div>`
      )
      .join(""),
    "</dl></header>"
  ].join("")
}

function renderTable(input: ReportDocumentInput, items: readonly ReportDocumentItem[]): string {
  if (items.length === 0) return `<p class="empty">${escapeHtml(input.labels.empty)}</p>`

  const headings = [
    `<th class="label">${escapeHtml(input.labels.dimension)}</th>`,
    `<th class="detail">${escapeHtml(input.labels.detail)}</th>`,
    ...input.labels.columns.map((column) => `<th class="figure">${escapeHtml(column)}</th>`)
  ].join("")

  const rows = items.map((item) => renderItem(input, item)).join("")

  return `<table><thead><tr>${headings}</tr></thead><tbody>${rows}</tbody></table>`
}

function renderItem(input: ReportDocumentInput, item: ReportDocumentItem): string {
  if (item.kind === "group") {
    const columnCount = input.labels.columns.length + 2

    return `<tr class="group"><td colspan="${columnCount}">${escapeHtml(item.currency)}</td></tr>`
  }

  if (item.kind === "totals") {
    return [
      '<tr class="totals">',
      `<td class="label">${escapeHtml(input.labels.total)}</td>`,
      `<td class="detail">${escapeHtml(item.currency)}</td>`,
      renderFigures(item.cells, item.currency, input.locale),
      "</tr>"
    ].join("")
  }

  return [
    `<tr style="height:${item.heightPx}px">`,
    `<td class="label">${escapeHtml(item.row.label)}</td>`,
    `<td class="detail">${escapeHtml(item.row.sublabel ?? "")}</td>`,
    renderFigures(item.row.cells, item.currency, input.locale),
    "</tr>"
  ].join("")
}

function renderFigures(cells: readonly ReportCell[], currency: string, locale: string): string {
  return cells
    .map(
      (cell) => `<td class="figure">${escapeHtml(formatReportCell(cell, currency, locale))}</td>`
    )
    .join("")
}

function renderFooter(input: ReportDocumentInput, index: number, pages: number): string {
  return [
    '<footer class="footer">',
    `<span>${escapeHtml(input.labels.title)}</span>`,
    `<span>${escapeHtml(input.labels.page(index + 1, pages))}</span>`,
    "</footer>"
  ].join("")
}

// The longest figure the document prints, in characters, across every row and every total. The
// column layout is sized to it, so it has to be measured in the same locale-aware form the cells
// print in, symbol and separators included.
function getWidestFigureLength(input: ReportDocumentInput): number {
  let widest = 0

  for (const group of input.result.groups) {
    const cells = [...group.rows.flatMap((row) => row.cells), ...group.totals]

    for (const cell of cells) {
      widest = Math.max(widest, formatReportCell(cell, group.currency, input.locale).length)
    }
  }

  return widest
}

// Every height and width here is the CSS half of a number `reportDocumentPages.ts` paginated or
// fitted against. A change to one without the other overflows a page or a column silently, which
// prints as a clipped row or a lost digit rather than as an error.
//
// The font stacks name local families only. The renderer aborts every network request
// (`lib/pdf/renderPdf.ts`), so DESIGN.md's JetBrains Mono cannot be fetched here and naming it would
// fall back mid-document; the tabular-figure rule it exists to serve is kept by
// `font-variant-numeric` instead, which every local family honours.
function documentCss(layout: ReportColumnLayout): string {
  return [
    `@page{size:${REPORT_PAGE_WIDTH_PX}px ${REPORT_PAGE_HEIGHT_PX}px;margin:0}`,
    "*{box-sizing:border-box}",
    "html,body{margin:0;padding:0;background:#fff;color:#0f172a}",
    "body{font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;",
    `font-size:${REPORT_TEXT_FONT_PX}px;-webkit-print-color-adjust:exact;print-color-adjust:exact}`,
    `.page{width:${REPORT_PAGE_WIDTH_PX}px;height:${REPORT_PAGE_HEIGHT_PX}px;`,
    `padding:${REPORT_PAGE_MARGIN_PX}px;overflow:hidden;page-break-after:always}`,
    ".page:last-child{page-break-after:auto}",
    ".sheet{display:flex;flex-direction:column;height:100%}",
    `.intro{height:${REPORT_INTRO_HEIGHT_PX}px;border-bottom:1px solid #0f172a;padding-bottom:12px}`,
    ".intro h1{margin:0;font-size:20px;font-weight:600;letter-spacing:-0.01em}",
    ".business{margin:2px 0 0;color:#475569}",
    ".meta{display:grid;grid-template-columns:repeat(2,1fr);gap:2px 24px;margin:12px 0 0}",
    ".meta div{display:flex;gap:6px}",
    ".meta dt{color:#64748b}",
    ".meta dd{margin:0;font-weight:500}",
    "table{width:100%;border-collapse:collapse;table-layout:fixed}",
    `thead th{height:${REPORT_TABLE_HEADER_HEIGHT_PX}px;border-bottom:1px solid #cbd5e1;`,
    "font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:#475569}",
    `tbody td{border-bottom:1px solid #e2e8f0;overflow:hidden;line-height:${REPORT_LINE_HEIGHT_PX}px;`,
    "padding-top:0;padding-bottom:0;overflow-wrap:anywhere}",
    `th.label,td.label{width:${layout.labelPercent.toFixed(3)}%;text-align:left;`,
    `padding-right:${REPORT_CELL_PADDING_PX}px}`,
    `th.detail,td.detail{width:${layout.detailPercent.toFixed(3)}%;text-align:left;`,
    `padding-right:${REPORT_CELL_PADDING_PX}px;color:#64748b}`,
    `th.figure,td.figure{width:${layout.figurePercent.toFixed(3)}%;text-align:right;`,
    `padding-left:${REPORT_CELL_PADDING_PX}px;padding-right:0;`,
    "font-variant-numeric:tabular-nums;",
    "font-family:ui-monospace,'SFMono-Regular',Menlo,Consolas,monospace}",
    `td.figure{font-size:${layout.figureFontPx}px;white-space:nowrap;overflow-wrap:normal}`,
    `tr.group td{height:${REPORT_GROUP_HEIGHT_PX}px;border-bottom:1px solid #94a3b8;`,
    "font-weight:600;letter-spacing:0.06em;vertical-align:bottom;padding-bottom:4px}",
    `tr.totals td{height:${REPORT_TOTALS_HEIGHT_PX}px;border-top:1px solid #0f172a;`,
    "border-bottom:none;font-weight:600}",
    ".empty{margin:24px 0 0;color:#64748b}",
    `.footer{margin-top:auto;height:${REPORT_FOOTER_HEIGHT_PX}px;display:flex;`,
    "align-items:flex-end;justify-content:space-between;color:#64748b;font-size:10px}"
  ].join("")
}
