import { escapeHtml } from "@/lib/utils"

import { type Block, type TemplatePageSettings } from "../schemas"

import {
  buildDetails,
  buildSummaryBand,
  buildTotals,
  estimateTableHeight,
  hasValue,
  lineItemsTable,
  linesHtml,
  presentLines,
  textBlock,
  token,
  type LayoutContext
} from "./builtInLayoutSections"
import {
  COLORS,
  CONTENT_WIDTH,
  DOCUMENT_SPECS,
  PAGE_SETTINGS,
  SECTION_GAP,
  SMALL_LINE_HEIGHT,
  type BuiltInLayoutLabels,
  type BuiltInLayoutType
} from "./builtInLayoutSpec"
import { type TemplateRenderData } from "./mergeVariables"

export {
  BUILT_IN_LAYOUT_TYPES,
  type BuiltInLayoutLabels,
  type BuiltInLayoutType
} from "./builtInLayoutSpec"

// The layout a document renders with when the instance has no template of its type: a block tree
// built in code and handed to `renderTemplate` like any template's, so there is one renderer and the
// preview-to-PDF path of ADR-0022 is untouched. Why it lives in code rather than in the `templates`
// table is ADR-0043.
//
// It is shaped by the document it renders rather than fixed. A stored template is a static canvas,
// so its line-items table is as tall as the owner drew it; a built-in knows the line items, so it
// sizes the table to them and places the totals below, and it leaves out a line whose amount does
// not apply — a late fee nobody was charged, a credit nothing issued — instead of printing an
// empty or zero row. Every value still reaches the page as a merge token, so escaping and
// formatting stay the renderer's and the render-data builders'.
//
// Contracts are absent on purpose: a contract snapshots its own blocks and cannot be sent without
// them (`features/contracts/mutations.ts`), so it never renders from a template.

export type BuiltInLayoutInput = {
  type: BuiltInLayoutType
  renderData: TemplateRenderData
  labels: BuiltInLayoutLabels
  // Variables whose line is left out because its amount is zero. The render data carries formatted
  // strings, and "zero" is not something a layout can read back out of one in every locale.
  omit: readonly string[]
}

export type BuiltInLayout = {
  blocks: Block[]
  pageSettings: TemplatePageSettings
}

export function buildBuiltInLayout({
  type,
  renderData,
  labels,
  omit
}: BuiltInLayoutInput): BuiltInLayout {
  const spec = DOCUMENT_SPECS[type]
  const values = renderData.values
  const present = (variable: string) => hasValue(values[variable]) && !omit.includes(variable)
  const label = (key: keyof BuiltInLayoutLabels) => escapeHtml(labels[key])
  const context: LayoutContext = { present, label, values }

  const blocks: Block[] = []

  const businessLines = presentLines(present, [
    ["business.addressLine1"],
    ["business.addressLine2"],
    ["business.postalCode", "business.city"],
    ["business.state", "business.country"],
    ["business.email"],
    ["business.phone"],
    ["business.taxId"]
  ])

  const businessHeight = SMALL_LINE_HEIGHT * businessLines.length

  blocks.push(
    textBlock(
      "builtin-business-name",
      { x: 0, y: 0, width: 400, height: 24 },
      token("business.name"),
      {
        fontSize: 16,
        fontWeight: "600",
        textColor: COLORS.ink
      }
    ),
    textBlock(
      "builtin-document-title",
      { x: CONTENT_WIDTH - 280, y: 0, width: 280, height: 32 },
      label(spec.title),
      { fontSize: 24, fontWeight: "700", textColor: COLORS.ink, textAlign: "right" }
    ),
    textBlock(
      "builtin-document-number",
      { x: CONTENT_WIDTH - 280, y: 36, width: 280, height: SMALL_LINE_HEIGHT },
      token(spec.number),
      { fontSize: 12, textColor: COLORS.muted, textAlign: "right" }
    )
  )

  if (businessLines.length > 0) {
    blocks.push(
      textBlock(
        "builtin-business-details",
        { x: 0, y: 28, width: 400, height: businessHeight },
        linesHtml(businessLines),
        { fontSize: 11, textColor: COLORS.muted, lineHeight: SMALL_LINE_HEIGHT / 11 }
      )
    )
  }

  const bandTop = Math.max(28 + businessHeight, 56) + SECTION_GAP
  const band = buildSummaryBand(spec, context, bandTop)

  blocks.push(...band.blocks)

  const tableTop = band.bottom + SECTION_GAP
  const tableHeight = estimateTableHeight(renderData)

  blocks.push(
    lineItemsTable(label, { x: 0, y: tableTop, width: CONTENT_WIDTH, height: tableHeight })
  )

  const lowerTop = tableTop + tableHeight + SECTION_GAP
  const totals = buildTotals(spec, context, lowerTop)
  const details = buildDetails(spec, context, lowerTop)

  blocks.push(...totals.blocks, ...details.blocks)

  return { blocks, pageSettings: PAGE_SETTINGS }
}
