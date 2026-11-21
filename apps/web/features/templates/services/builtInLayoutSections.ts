import { type Block, type BlockStyle } from "../schemas"

import {
  COLORS,
  CONTENT_WIDTH,
  DESCRIPTION_CHARACTERS_PER_LINE,
  LINE_HEIGHT,
  LINE_ITEM_COLUMNS,
  NOTE_CHARACTERS_PER_LINE,
  PANEL_PADDING,
  SECTION_GAP,
  SMALL_LINE_HEIGHT,
  TABLE_HEADER_HEIGHT,
  TABLE_ROW_PADDING,
  TOTALS_ROW_HEIGHT,
  TOTALS_WIDTH,
  type BuiltInLayoutLabels,
  type DocumentSpec
} from "./builtInLayoutSpec"
import { type MergeVariableId, type TemplateRenderData } from "./mergeVariables"

// The sections of a built-in layout that are sized by the document they render — the summary panel,
// the totals, the payment details and note — and the block factories they share. Composed in order
// by `builtInLayout.ts`'s `buildBuiltInLayout`, which passes each the top edge the one above it left.

export type Present = (variable: string) => boolean

export type Label = (key: keyof BuiltInLayoutLabels) => string

export type LayoutContext = {
  present: Present
  label: Label
  values: TemplateRenderData["values"]
}

export type Section = {
  blocks: Block[]
  bottom: number
}

// The summary a reader looks for first, on one muted panel: who the document is for, its dates,
// and the one figure it asks for.
export function buildSummaryBand(
  spec: DocumentSpec,
  { present, label }: LayoutContext,
  top: number
): Section {
  const clientLines = presentLines(present, [
    ["client.addressLine1"],
    ["client.addressLine2"],
    ["client.postalCode", "client.city"],
    ["client.state", "client.country"],
    ["client.taxId"]
  ])

  const facts = spec.facts.filter((fact) => present(fact.variable))

  const columnWidth = Math.floor((CONTENT_WIDTH - PANEL_PADDING * 2) / 3)
  const clientHeight = SMALL_LINE_HEIGHT * (2 + clientLines.length)
  const factsHeight = SMALL_LINE_HEIGHT * 2 * Math.max(facts.length, 1)
  const innerHeight = Math.max(clientHeight, factsHeight, 48)
  const bandHeight = innerHeight + PANEL_PADDING * 2
  const innerTop = top + PANEL_PADDING

  const blocks: Block[] = [
    {
      id: "builtin-summary-panel",
      type: "shape",
      layout: { x: 0, y: top, width: CONTENT_WIDTH, height: bandHeight },
      hidden: false,
      locked: false,
      content: { variant: "rectangle" },
      style: { backgroundColor: COLORS.surface, borderRadius: 8 }
    },
    textBlock(
      "builtin-counterparty",
      { x: PANEL_PADDING, y: innerTop, width: columnWidth, height: clientHeight },
      [
        `<div style="color:${COLORS.muted}">${label(spec.counterparty)}</div>`,
        `<div><strong>${token("client.name")}</strong></div>`,
        ...clientLines.map((line) => `<div>${line}</div>`)
      ].join(""),
      { fontSize: 11, textColor: COLORS.ink, lineHeight: SMALL_LINE_HEIGHT / 11 }
    )
  ]

  if (facts.length > 0) {
    blocks.push(
      textBlock(
        "builtin-facts",
        {
          x: PANEL_PADDING + columnWidth,
          y: innerTop,
          width: columnWidth,
          height: factsHeight
        },
        facts
          .map(
            (fact) =>
              `<div style="color:${COLORS.muted}">${label(fact.label)}</div><div>${token(fact.variable)}</div>`
          )
          .join(""),
        { fontSize: 11, textColor: COLORS.ink, lineHeight: SMALL_LINE_HEIGHT / 11 }
      )
    )
  }

  blocks.push(
    textBlock(
      "builtin-headline-label",
      {
        x: PANEL_PADDING + columnWidth * 2,
        y: innerTop,
        width: columnWidth,
        height: SMALL_LINE_HEIGHT
      },
      label(spec.headline.label),
      { fontSize: 11, textColor: COLORS.muted, textAlign: "right" }
    ),
    textBlock(
      "builtin-headline-value",
      {
        x: PANEL_PADDING + columnWidth * 2,
        y: innerTop + SMALL_LINE_HEIGHT + 4,
        width: columnWidth,
        height: 28
      },
      token(spec.headline.variable),
      { fontSize: 20, fontWeight: "600", textColor: COLORS.accent, textAlign: "right" }
    )
  )

  return { blocks, bottom: top + bandHeight }
}

// A hairline-ringed panel of label and figure pairs: two text columns sharing one line height, so
// each label sits level with its figure and the right-aligned figures stack digit over digit. Two columns rather than one row per pair because the document sanitizer admits
// no layout property that would put a label and a value on one line (`sanitizeHtml.ts`). A line
// whose variable is absent or omitted is not drawn, which is what keeps a document that never had a
// late fee or a credit from printing one.
export function buildTotals(
  spec: DocumentSpec,
  { present, label }: LayoutContext,
  top: number
): Section {
  const lines = spec.totals.filter((line) => line.weight !== undefined || present(line.variable))
  const innerHeight = lines.length * TOTALS_ROW_HEIGHT
  const height = innerHeight + PANEL_PADDING
  const x = CONTENT_WIDTH - TOTALS_WIDTH
  const columnWidth = (TOTALS_WIDTH - PANEL_PADDING * 2) / 2
  const rowStyle = { fontSize: 12, textColor: COLORS.ink, lineHeight: TOTALS_ROW_HEIGHT / 12 }

  const labels = lines
    .map((line) => {
      const style = line.weight ? "font-weight:600" : `color:${COLORS.muted}`

      return `<div style="${style}">${label(line.label)}</div>`
    })
    .join("")

  const figures = lines
    .map((line) => {
      const style =
        line.weight === "emphasis"
          ? `color:${COLORS.accent};font-weight:600`
          : line.weight === "strong"
            ? "font-weight:600"
            : ""

      return style
        ? `<div style="${style}">${token(line.variable)}</div>`
        : `<div>${token(line.variable)}</div>`
    })
    .join("")

  const inner = { y: top + PANEL_PADDING / 2, height: innerHeight }

  return {
    blocks: [
      {
        id: "builtin-totals-panel",
        type: "shape",
        layout: { x, y: top, width: TOTALS_WIDTH, height },
        hidden: false,
        locked: false,
        content: { variant: "rectangle" },
        style: { borderWidth: 1, borderColor: COLORS.hairline, borderRadius: 8 }
      },
      textBlock(
        "builtin-totals",
        { x: x + PANEL_PADDING, width: columnWidth, ...inner },
        labels,
        rowStyle
      ),
      textBlock(
        "builtin-totals-figures",
        { x: x + PANEL_PADDING + columnWidth, width: columnWidth, ...inner },
        figures,
        { ...rowStyle, textAlign: "right" }
      )
    ],
    bottom: top + height
  }
}

// Payment details and the free-text note share the column left of the totals, each drawn only when
// it has something to say.
export function buildDetails(
  spec: DocumentSpec,
  { present, label, values }: LayoutContext,
  top: number
): Section {
  const width = CONTENT_WIDTH - TOTALS_WIDTH - SECTION_GAP
  const blocks: Block[] = []

  let cursor = top

  const paymentFields = spec.paymentDetails
    ? (
        [
          ["bank", "payment.bankName"],
          ["iban", "payment.iban"]
        ] as const
      ).filter(([, variable]) => present(variable))
    : []
  const hasInstructions = spec.paymentDetails && present("payment.instructions")

  if (paymentFields.length > 0 || hasInstructions) {
    const instructionLines = hasInstructions
      ? estimateLines(textOf(values["payment.instructions"]), NOTE_CHARACTERS_PER_LINE)
      : 0
    const height = SMALL_LINE_HEIGHT * (1 + paymentFields.length * 2 + instructionLines)

    blocks.push(
      textBlock(
        "builtin-payment",
        { x: 0, y: cursor, width, height },
        [
          `<div style="font-weight:600">${label("payment")}</div>`,
          ...paymentFields.map(
            ([key, variable]) =>
              `<div style="color:${COLORS.muted}">${label(key)}</div><div>${token(variable)}</div>`
          ),
          hasInstructions ? `<div>${token("payment.instructions")}</div>` : ""
        ].join(""),
        { fontSize: 11, textColor: COLORS.ink, lineHeight: SMALL_LINE_HEIGHT / 11 }
      )
    )

    cursor += height + SECTION_GAP
  }

  if (present(spec.note.variable)) {
    const height =
      SMALL_LINE_HEIGHT *
      (1 + estimateLines(textOf(values[spec.note.variable]), NOTE_CHARACTERS_PER_LINE))

    blocks.push(
      textBlock(
        "builtin-note",
        { x: 0, y: cursor, width, height },
        `<div style="font-weight:600">${label(spec.note.label)}</div><div>${token(spec.note.variable)}</div>`,
        { fontSize: 11, textColor: COLORS.ink, lineHeight: SMALL_LINE_HEIGHT / 11 }
      )
    )

    cursor += height
  }

  return { blocks, bottom: cursor }
}

export function lineItemsTable(label: Label, layout: Block["layout"]): Block {
  return {
    id: "builtin-line-items",
    type: "table",
    layout,
    hidden: false,
    locked: false,
    content: {
      source: "lineItems",
      columns: LINE_ITEM_COLUMNS.map((column) => ({
        id: column.id,
        header: label(column.label),
        width: column.width,
        binding: column.binding
      })),
      rows: []
    },
    style: { fontSize: 11, textColor: COLORS.ink }
  }
}

export function estimateTableHeight(renderData: TemplateRenderData): number {
  const rows = renderData.lineItems ?? []

  return rows.reduce((height, row) => {
    const lines = estimateLines(
      textOf(row["lineItem.description"]),
      DESCRIPTION_CHARACTERS_PER_LINE
    )

    return height + lines * LINE_HEIGHT + TABLE_ROW_PADDING
  }, TABLE_HEADER_HEIGHT)
}

// A line per paragraph, and as many more as the paragraph wraps at `perLine` characters.
function estimateLines(text: string, perLine: number): number {
  return text
    .split("\n")
    .reduce((lines, paragraph) => lines + Math.max(1, Math.ceil(paragraph.length / perLine)), 0)
}

// Each entry is one printed line built from the variables that have a value, joined with a space
// or a comma the way an address reads; a line none of whose variables has a value is dropped.
export function presentLines(
  present: Present,
  lines: readonly (readonly MergeVariableId[])[]
): string[] {
  return lines.flatMap((variables) => {
    const tokens = variables.filter(present).map(token)

    if (tokens.length === 0) return []

    return [
      tokens.join(
        variables.includes("business.state") || variables.includes("client.state") ? ", " : " "
      )
    ]
  })
}

export function linesHtml(lines: readonly string[]): string {
  return lines.map((line) => `<div>${line}</div>`).join("")
}

export function token(variable: MergeVariableId): string {
  return `{{${variable}}}`
}

export function hasValue(value: unknown): boolean {
  return textOf(value).trim() !== ""
}

// Render values arrive as `unknown`; the builders set strings and, for a count, a number.
function textOf(value: unknown): string {
  if (typeof value === "string") return value

  return typeof value === "number" ? String(value) : ""
}

export function textBlock(
  id: string,
  layout: Block["layout"],
  html: string,
  style: BlockStyle
): Block {
  return {
    id,
    type: "text",
    layout: { ...layout, height: Math.max(layout.height, 16) },
    hidden: false,
    locked: false,
    content: { html },
    style
  }
}
