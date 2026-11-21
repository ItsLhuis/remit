import { type Translations } from "@/lib/i18n/types"

import { type TableColumn, type TemplatePageSettings } from "../schemas"

import { getContentBounds } from "./canvasLayout"
import { type MergeVariableId } from "./mergeVariables"

// The fixed half of `builtInLayout.ts`: which figures each built-in document prints and in what
// order, and the page geometry and palette they are drawn with. The half that depends on the
// document being rendered is `builtInLayoutSections.ts`.

export const BUILT_IN_LAYOUT_TYPES = ["invoice", "proposal", "credit_note"] as const

export type BuiltInLayoutType = (typeof BUILT_IN_LAYOUT_TYPES)[number]

// Exactly the `templates.builtInLayout` translations, so a label is added once, in
// `lib/i18n/types.ts`, and the compiler carries it to `en.tsx` and to `documentLayout.ts`, which
// translates each one.
export type BuiltInLayoutLabels = Translations["templates"]["builtInLayout"]

export type TotalLine = {
  label: keyof BuiltInLayoutLabels
  variable: MergeVariableId
  weight?: "strong" | "emphasis"
}

export type DocumentSpec = {
  title: keyof BuiltInLayoutLabels
  number: MergeVariableId
  counterparty: keyof BuiltInLayoutLabels
  facts: readonly { label: keyof BuiltInLayoutLabels; variable: MergeVariableId }[]
  headline: { label: keyof BuiltInLayoutLabels; variable: MergeVariableId }
  totals: readonly TotalLine[]
  paymentDetails: boolean
  note: { label: keyof BuiltInLayoutLabels; variable: MergeVariableId }
}

export const DOCUMENT_SPECS: Record<BuiltInLayoutType, DocumentSpec> = {
  invoice: {
    title: "invoiceTitle",
    number: "invoice.number",
    counterparty: "billTo",
    facts: [
      { label: "issueDate", variable: "invoice.issueDate" },
      { label: "dueDate", variable: "invoice.dueDate" }
    ],
    headline: { label: "amountDue", variable: "invoice.amountDue" },
    totals: [
      { label: "subtotal", variable: "invoice.subtotal" },
      { label: "discount", variable: "invoice.discount" },
      { label: "tax", variable: "invoice.tax" },
      { label: "lateFee", variable: "invoice.lateFee" },
      { label: "total", variable: "invoice.total", weight: "strong" },
      { label: "amountPaid", variable: "invoice.amountPaid" },
      { label: "credited", variable: "invoice.credited" },
      { label: "amountDue", variable: "invoice.amountDue", weight: "emphasis" }
    ],
    paymentDetails: true,
    note: { label: "notes", variable: "invoice.notes" }
  },
  proposal: {
    title: "proposalTitle",
    number: "proposal.number",
    counterparty: "preparedFor",
    facts: [
      { label: "issueDate", variable: "proposal.issueDate" },
      { label: "validUntil", variable: "proposal.validUntil" }
    ],
    headline: { label: "proposalTotal", variable: "proposal.total" },
    totals: [
      { label: "subtotal", variable: "proposal.subtotal" },
      { label: "discount", variable: "proposal.discount" },
      { label: "tax", variable: "proposal.tax" },
      { label: "total", variable: "proposal.total", weight: "emphasis" }
    ],
    paymentDetails: false,
    note: { label: "notes", variable: "proposal.notes" }
  },
  // A credit note carries the payment details because a refund goes back through them, which is
  // also why `MERGE_VARIABLES.credit_note` includes the payment group.
  credit_note: {
    title: "creditNoteTitle",
    number: "creditNote.number",
    counterparty: "billTo",
    facts: [
      { label: "issued", variable: "creditNote.issueDate" },
      { label: "correctsInvoice", variable: "creditNote.invoiceNumber" }
    ],
    headline: { label: "creditTotal", variable: "creditNote.total" },
    totals: [
      { label: "subtotal", variable: "creditNote.subtotal" },
      { label: "tax", variable: "creditNote.tax" },
      { label: "creditTotal", variable: "creditNote.total", weight: "emphasis" }
    ],
    paymentDetails: true,
    note: { label: "reason", variable: "creditNote.reason" }
  }
}

// DESIGN.md's achromatic neutrals (Ink, Muted Foreground, Muted Surface, Hairline) and its one
// accent, as the hex the block style schema accepts. The accent marks the single figure a reader
// acts on and nothing else.
//
// Figures are set in the page's sans face and right-aligned rather than in the mono face DESIGN.md
// gives them on screen: the PDF renderer loads no web font (`documentShell.ts`), so JetBrains Mono
// is absent there and its fallback is Courier, while the system sans has tabular digits of its own.
export const COLORS = {
  ink: "#0a0a0a",
  muted: "#737373",
  surface: "#f5f5f5",
  hairline: "#e5e5e5",
  accent: "#1447e6"
} as const

export const PAGE_SETTINGS: TemplatePageSettings = {
  margins: { top: 48, right: 48, bottom: 48, left: 48 },
  fontFamily: "sans",
  baseFontSize: 12
}

// The canvas's own content box, snapped to the grid, so a built-in passes `validateLayout` exactly as
// an authored template must.
export const CONTENT_WIDTH = getContentBounds("invoice", PAGE_SETTINGS).width

export const LINE_HEIGHT = 16
export const SMALL_LINE_HEIGHT = 16
export const SECTION_GAP = 24
export const PANEL_PADDING = 16
export const TOTALS_WIDTH = 296
export const TOTALS_ROW_HEIGHT = 22

// Every fixed column is a multiple of the 8px grid, as `tableColumnWidthSchema` requires; the
// description takes whatever width is left.
export const LINE_ITEM_COLUMNS: readonly {
  id: string
  label: keyof BuiltInLayoutLabels
  width: number | null
  binding: TableColumn["binding"]
}[] = [
  { id: "description", label: "description", width: null, binding: "lineItem.description" },
  { id: "quantity", label: "quantity", width: 64, binding: "lineItem.quantity" },
  { id: "unitPrice", label: "unitPrice", width: 112, binding: "lineItem.unitPrice" },
  { id: "tax", label: "tax", width: 72, binding: "lineItem.taxPercentage" },
  { id: "amount", label: "amount", width: 112, binding: "lineItem.total" }
]

// The renderer's table cells carry 4px of vertical padding and a 1px border around one line of the
// page's 12px type. A description wraps at roughly this many characters in the width left to it —
// deliberately fewer than fit, because a table sized short would run under the totals below it,
// while one sized long only leaves white space.
export const TABLE_HEADER_HEIGHT = 32
export const TABLE_ROW_PADDING = 10
export const DESCRIPTION_CHARACTERS_PER_LINE = 48
export const NOTE_CHARACTERS_PER_LINE = 60
