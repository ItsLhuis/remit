import { escapeHtml } from "@/lib/utils"

import {
  type Block,
  type TableColumn,
  type TemplatePageSettings,
  type TemplateType
} from "../schemas"

import { getPageHeight } from "./canvasLayout"
import {
  MERGE_TOKEN_SOURCE,
  type LineItemRenderRow,
  type TemplateRenderData
} from "./mergeVariables"
import {
  authoredText,
  createRenderContext,
  formatMergeValue,
  mergeValue,
  type RenderContext,
  type RenderFormat
} from "./renderContext"
import { sanitizeTemplateHtml, toPlainText, type SanitizedHtml } from "./sanitizeHtml"
import { blockStyleToCss, pageStyleToCss, rotationToCss } from "./styleCss"

// Pure block -> HTML/text renderer. The same function powers the in-app live preview and the
// headless-browser PDF job (ADR-0022), so preview and PDF share one HTML/CSS path, and the page
// height comes from getPageHeight - the exact formula the canvas uses.
//
// Trust model: authored markup was already reduced to the "authored" whitelist at save time, but
// merge VALUES may derive from client-entered data, so every substituted value is HTML-escaped and
// the assembled document runs through sanitizeTemplateHtml as defense in depth. Tokens are
// substituted by dictionary lookup against the per-type whitelist, never evaluated. Images resolve
// through the assets map, so the renderer never receives or emits an external image URL.

type RenderTemplateInput = {
  blocks: Block[]
  renderData: TemplateRenderData
  type: TemplateType
  format: RenderFormat
  pageSettings: TemplatePageSettings
  assets?: Record<string, string>
}

type RenderBlockInput = {
  renderData: TemplateRenderData
  type: TemplateType
  assets?: Record<string, string>
}

// Must default to true: the preview/PDF path never passes it and its output must stay
// byte-identical. Only the editor passes false, to render a frame without baking child HTML.
type RenderContentOptions = {
  includeChildren?: boolean
}

// The reserved assets-map key for the business logo, resolved server-side from settings.
export const BUSINESS_LOGO_ASSET_KEY = "businessLogo"

const TABLE_CELL_CSS = "padding:4px 8px;border:1px solid #e2e8f0;text-align:left;vertical-align:top"

export function renderTemplate({
  blocks,
  renderData,
  type,
  format,
  pageSettings,
  assets = {}
}: RenderTemplateInput): string {
  const context = createRenderContext(renderData, type, format, assets)

  // Array order is z-order. Do not sort by position: overlap is legal and paint order is the
  // layering.
  const visible = blocks.filter((block) => !block.hidden)

  if (format === "text") {
    return visible
      .flatMap((block) => {
        const text = renderBlockAsText(block, context)

        return text ? [text] : []
      })
      .join("\n\n")
  }

  const pageHeight = getPageHeight(blocks, type, pageSettings)

  const body = visible.map((block) => absoluteBlockHtml(block, context, pageSettings)).join("\n")

  const page = `<div style="${pageStyleToCss(type, pageSettings, pageHeight)}">\n${body}\n</div>`

  return sanitizeTemplateHtml(page, { profile: "document" })
}

// The canvas editor renders through this same path, so what the user arranges is the renderer's
// markup and never an approximation. The canvas owns the box; this is the content inside it.
export function renderBlockContent(
  block: Block,
  input: RenderBlockInput,
  options: RenderContentOptions = {}
): SanitizedHtml {
  const context = createRenderContext(input.renderData, input.type, "html", input.assets ?? {})

  // A shape's fill div already carries its style, and a group has none of its own.
  const styleCss =
    block.type === "shape" || block.type === "group" ? "" : blockStyleToCss(block.style)
  const content = blockContentHtml(block, context, options)

  const wrapped = styleCss ? `<div style="${styleCss};height:100%">${content}</div>` : content

  return sanitizeTemplateHtml(wrapped, { profile: "document" })
}

function absoluteBlockHtml(
  block: Block,
  context: RenderContext,
  pageSettings: TemplatePageSettings
): string {
  const { x, y, width, height } = block.layout

  const positionCss = [
    "position:absolute",
    `left:${pageSettings.margins.left + x}px`,
    `top:${pageSettings.margins.top + y}px`,
    `width:${width}px`,
    `height:${height}px`
  ].join(";")

  // The wrapper skips a shape's block style, so a transparent rounded fill never shows a
  // rectangular background behind it. A group has no style of its own.
  const css = [
    positionCss,
    rotationToCss(block.type === "group" ? undefined : block.rotation),
    block.type === "shape" || block.type === "group" ? "" : blockStyleToCss(block.style)
  ]
    .filter(Boolean)
    .join(";")

  return `<div style="${css}">${blockContentHtml(block, context)}</div>`
}

function blockContentHtml(
  block: Block,
  context: RenderContext,
  options: RenderContentOptions = {}
): string {
  switch (block.type) {
    case "text":
      return `<div>${substitute(block.content.html, context)}</div>`
    case "image": {
      const source = resolveImageSource(block, context)

      if (!source) return ""

      return `<img src="${escapeHtml(source)}" alt="${escapeHtml(block.content.alt)}" style="width:100%;height:100%;object-fit:contain" />`
    }
    case "table":
      return tableHtml(block.content, context)
    case "frame":
      return frameHtml(block, context, options)
    case "group":
      return groupHtml(block, context, options)
    case "shape":
      return shapeHtml(block)
  }
}

// Background, border, and radius live on one 100%-fill div, so an ellipse's rounding and its fill
// are the same element.
function shapeHtml(block: Extract<Block, { type: "shape" }>): string {
  const fillCss = [
    "width:100%",
    "height:100%",
    blockStyleToCss(block.style),
    block.content.variant === "ellipse" ? "border-radius:50%" : ""
  ]
    .filter(Boolean)
    .join(";")

  return `<div style="${fillCss}"></div>`
}

function resolveImageSource(
  block: Extract<Block, { type: "image" }>,
  context: RenderContext
): string | undefined {
  if (block.content.source === "businessLogo") return context.assets[BUSINESS_LOGO_ASSET_KEY]

  return block.content.uploadId ? context.assets[block.content.uploadId] : undefined
}

// A line-items table draws its body from the render data's collection, each column mapped through
// its lineItem.* binding; manual rows carry authored cell text instead.
function tableHtml(
  content: Extract<Block, { type: "table" }>["content"],
  context: RenderContext
): string {
  const header = content.columns
    .map((column) => {
      const widthCss = column.width !== null ? `;width:${column.width}px` : ""

      return `<th style="${TABLE_CELL_CSS}${widthCss}">${substitute(escapeHtml(column.header), context)}</th>`
    })
    .join("")

  const bodyRows =
    content.source === "lineItems"
      ? (context.data.lineItems ?? []).map((row) => lineItemRowHtml(content.columns, row, context))
      : content.rows.map(
          (row) =>
            `<tr>${row.cells
              .map(
                (cell) =>
                  `<td style="${TABLE_CELL_CSS}">${substitute(escapeHtml(cell), context)}</td>`
              )
              .join("")}</tr>`
        )

  return `<table style="width:100%;border-collapse:collapse"><thead><tr>${header}</tr></thead><tbody>${bodyRows.join("")}</tbody></table>`
}

function lineItemRowHtml(
  columns: readonly TableColumn[],
  row: LineItemRenderRow,
  context: RenderContext
): string {
  const cells = columns
    .map((column) => {
      const value = column.binding ? formatMergeValue(row[column.binding]) : ""

      return `<td style="${TABLE_CELL_CSS}">${context.format === "html" ? escapeHtml(value) : value}</td>`
    })
    .join("")

  return `<tr>${cells}</tr>`
}

// Children are absolutely positioned relative to the frame's content origin, in array (z) order.
// includeChildren:false skips the recursive child markup - the editor's own path.
function frameHtml(
  block: Extract<Block, { type: "frame" }>,
  context: RenderContext,
  options: RenderContentOptions = {}
): string {
  const containerCss = [
    "position:relative",
    "width:100%",
    "height:100%",
    block.content.clip ? "overflow:hidden" : ""
  ]
    .filter(Boolean)
    .join(";")

  const childHtml =
    (options.includeChildren ?? true)
      ? block.content.children
          .map((child) => (child.hidden ? "" : childBlockHtml(child, context)))
          .join("")
      : ""

  return `<div style="${containerCss}">${childHtml}</div>`
}

// A purely logical container: no clip, no style of its own, children positioned exactly as a
// frame's are.
function groupHtml(
  block: Extract<Block, { type: "group" }>,
  context: RenderContext,
  options: RenderContentOptions = {}
): string {
  const childHtml =
    (options.includeChildren ?? true)
      ? block.content.children
          .map((child) => (child.hidden ? "" : childBlockHtml(child, context)))
          .join("")
      : ""

  return `<div style="position:relative;width:100%;height:100%">${childHtml}</div>`
}

function childBlockHtml(child: Block, context: RenderContext): string {
  const { x, y, width, height } = child.layout

  const positionCss = [
    "position:absolute",
    `left:${x}px`,
    `top:${y}px`,
    `width:${width}px`,
    `height:${height}px`
  ].join(";")

  // Skips a shape's block style exactly as the top-level absoluteBlockHtml does.
  const css = [
    positionCss,
    rotationToCss(child.type === "group" ? undefined : child.rotation),
    child.type === "shape" || child.type === "group" ? "" : blockStyleToCss(child.style)
  ]
    .filter(Boolean)
    .join(";")

  return `<div style="${css}">${blockContentHtml(child, context)}</div>`
}

function renderBlockAsText(block: Block, context: RenderContext): string {
  switch (block.type) {
    case "text":
      return toPlainText(substitute(block.content.html, context))
    case "image":
      return authoredText(context, block.content.alt)
    case "table":
      return tableText(block.content, context)
    case "frame":
    case "group":
      return block.content.children
        .flatMap((child) => {
          if (child.hidden) return []

          const text = renderBlockAsText(child, context)

          return text ? [text] : []
        })
        .join("\n")
    case "shape":
      return ""
  }
}

function tableText(
  content: Extract<Block, { type: "table" }>["content"],
  context: RenderContext
): string {
  const header = content.columns.map((column) => substitute(column.header, context)).join(" | ")

  const rows =
    content.source === "lineItems"
      ? (context.data.lineItems ?? []).map((row) =>
          content.columns
            .map((column) => (column.binding ? formatMergeValue(row[column.binding]) : ""))
            .join(" | ")
        )
      : content.rows.map((row) => row.cells.map((cell) => substitute(cell, context)).join(" | "))

  return [header, ...rows].filter(Boolean).join("\n")
}

function substitute(source: string, context: RenderContext): string {
  const pattern = new RegExp(MERGE_TOKEN_SOURCE, "g")

  return source.replace(pattern, (_match, path: string) => mergeValue(context, path))
}
