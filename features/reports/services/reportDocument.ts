import { escapeHtml, formatDate } from "@/lib/utils"

import { formatReportCell } from "./formatReportCell"
import {
  paginateReportDocumentItems,
  REPORT_FOOTER_HEIGHT_PX,
  REPORT_GROUP_HEIGHT_PX,
  REPORT_INTRO_HEIGHT_PX,
  REPORT_PAGE_HEIGHT_PX,
  REPORT_PAGE_MARGIN_PX,
  REPORT_PAGE_WIDTH_PX,
  REPORT_ROW_HEIGHT_PX,
  REPORT_TABLE_HEADER_HEIGHT_PX,
  REPORT_TOTALS_HEIGHT_PX,
  toReportDocumentItems,
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
  const pages = paginateReportDocumentItems(toReportDocumentItems(input.result))

  const body = pages.map((items, index) => renderPage(input, items, index, pages.length)).join("")

  return {
    html: [
      "<!doctype html>",
      '<html><head><meta charset="utf-8" />',
      `<style>${documentCss(input.labels.columns.length)}</style>`,
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
    "<tr>",
    `<td class="label"><span class="clamp">${escapeHtml(item.row.label)}</span></td>`,
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

// Every height here is the CSS half of a constant `reportDocumentPages.ts` paginated against. A
// change to one without the other overflows a page silently, which prints as a clipped last row
// rather than as an error.
//
// The font stacks name local families only. The renderer aborts every network request
// (`lib/pdf/renderPdf.ts`), so DESIGN.md's JetBrains Mono cannot be fetched here and naming it would
// fall back mid-document; the tabular-figure rule it exists to serve is kept by
// `font-variant-numeric` instead, which every local family honours.
function documentCss(figureColumnCount: number): string {
  const figureWidth = (64 / Math.max(figureColumnCount, 1)).toFixed(3)
  // A wide report divides the same page across more columns, so the figures step down a size rather
  // than clip: `table-layout: fixed` gives each column its share whatever fits, and an amount that
  // overflows is truncated silently. Eleven point is what a six-column report needs to hold a
  // six-figure amount.
  const figureFontSize = figureColumnCount >= 5 ? 10 : 11

  return [
    `@page{size:${REPORT_PAGE_WIDTH_PX}px ${REPORT_PAGE_HEIGHT_PX}px;margin:0}`,
    "*{box-sizing:border-box}",
    "html,body{margin:0;padding:0;background:#fff;color:#0f172a}",
    "body{font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;",
    "font-size:11px;-webkit-print-color-adjust:exact;print-color-adjust:exact}",
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
    `tbody td{height:${REPORT_ROW_HEIGHT_PX}px;border-bottom:1px solid #e2e8f0;overflow:hidden}`,
    "th.label,td.label{width:24%;text-align:left;padding-right:8px}",
    "th.detail,td.detail{width:12%;text-align:left;padding-right:8px;color:#64748b}",
    `th.figure,td.figure{width:${figureWidth}%;text-align:right;padding-left:8px;`,
    `font-size:${figureFontSize}px;font-variant-numeric:tabular-nums;`,
    "font-family:ui-monospace,'SFMono-Regular',Menlo,Consolas,monospace}",
    ".clamp{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;line-height:13px}",
    `tr.group td{height:${REPORT_GROUP_HEIGHT_PX}px;border-bottom:1px solid #94a3b8;`,
    "font-weight:600;letter-spacing:0.06em;vertical-align:bottom;padding-bottom:4px}",
    `tr.totals td{height:${REPORT_TOTALS_HEIGHT_PX}px;border-top:1px solid #0f172a;`,
    "border-bottom:none;font-weight:600}",
    ".empty{margin:24px 0 0;color:#64748b}",
    `.footer{margin-top:auto;height:${REPORT_FOOTER_HEIGHT_PX}px;display:flex;`,
    "align-items:flex-end;justify-content:space-between;color:#64748b;font-size:10px}"
  ].join("")
}
