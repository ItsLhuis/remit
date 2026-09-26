import { and, eq, isNull } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { database } from "@/database"
import { templates } from "@/database/schema"

import { type Block, type TemplatePageSettings } from "./schemas"
import {
  buildBuiltInLayout,
  placesMergeVariable,
  toTemplateEditorData,
  type BuiltInLayoutLabels,
  type BuiltInLayoutType,
  type MergeVariableId,
  type TemplateRenderData
} from "./services"

// The one place a document's layout is chosen: the document's own template, else the instance
// default for its type, else the built-in layout (ADR-0043). Every PDF builder asks here, so no
// document type can grow its own idea of what "no template" means, and a sent document always has a
// layout to render before its mail is chained.
//
// A template with nothing on its canvas counts as none. It renders a blank page, and a blank money
// document is worse than the built-in one the owner would otherwise have received.

export type DocumentLayout = {
  blocks: Block[]
  pageSettings: TemplatePageSettings
}

export type ResolveDocumentLayoutInput = {
  type: BuiltInLayoutType
  templateId: string | null
  renderData: TemplateRenderData
  // See `BuiltInLayoutInput.omit` in services/builtInLayout.ts.
  omit: readonly MergeVariableId[]
}

export async function resolveDocumentLayout({
  type,
  templateId,
  renderData,
  omit
}: ResolveDocumentLayoutInput): Promise<DocumentLayout> {
  const template = await findDocumentTemplate(type, templateId)

  if (template) return template

  return buildBuiltInLayout({ type, renderData, labels: getBuiltInLayoutLabels(), omit })
}

// Whether a document of this type, rendered today, would print the variable. The built-in layout
// prints every figure that applies, so only an owner's template can leave one off.
export async function documentLayoutPlaces(
  type: BuiltInLayoutType,
  templateId: string | null,
  variable: MergeVariableId
): Promise<boolean> {
  const template = await findDocumentTemplate(type, templateId)

  return template ? placesMergeVariable(template.blocks, variable) : true
}

async function findDocumentTemplate(
  type: BuiltInLayoutType,
  templateId: string | null
): Promise<DocumentLayout | null> {
  const own = templateId
    ? await database.query.templates.findFirst({
        where: and(eq(templates.id, templateId), isNull(templates.deletedAt))
      })
    : undefined

  const row =
    own ??
    (await database.query.templates.findFirst({
      where: and(
        eq(templates.type, type),
        eq(templates.isDefault, true),
        isNull(templates.deletedAt)
      )
    }))

  if (!row) return null

  const editorData = toTemplateEditorData(row)

  if (editorData.blocks.length === 0) return null

  return { blocks: editorData.blocks, pageSettings: editorData.pageSettings }
}

function getBuiltInLayoutLabels(): BuiltInLayoutLabels {
  return {
    invoiceTitle: t("templates.builtInLayout.invoiceTitle"),
    proposalTitle: t("templates.builtInLayout.proposalTitle"),
    creditNoteTitle: t("templates.builtInLayout.creditNoteTitle"),
    billTo: t("templates.builtInLayout.billTo"),
    preparedFor: t("templates.builtInLayout.preparedFor"),
    issueDate: t("templates.builtInLayout.issueDate"),
    dueDate: t("templates.builtInLayout.dueDate"),
    validUntil: t("templates.builtInLayout.validUntil"),
    issued: t("templates.builtInLayout.issued"),
    correctsInvoice: t("templates.builtInLayout.correctsInvoice"),
    amountDue: t("templates.builtInLayout.amountDue"),
    proposalTotal: t("templates.builtInLayout.proposalTotal"),
    creditTotal: t("templates.builtInLayout.creditTotal"),
    description: t("templates.builtInLayout.description"),
    quantity: t("templates.builtInLayout.quantity"),
    unitPrice: t("templates.builtInLayout.unitPrice"),
    tax: t("templates.builtInLayout.tax"),
    amount: t("templates.builtInLayout.amount"),
    subtotal: t("templates.builtInLayout.subtotal"),
    discount: t("templates.builtInLayout.discount"),
    lateFee: t("templates.builtInLayout.lateFee"),
    total: t("templates.builtInLayout.total"),
    amountPaid: t("templates.builtInLayout.amountPaid"),
    credited: t("templates.builtInLayout.credited"),
    payment: t("templates.builtInLayout.payment"),
    bank: t("templates.builtInLayout.bank"),
    iban: t("templates.builtInLayout.iban"),
    notes: t("templates.builtInLayout.notes"),
    reason: t("templates.builtInLayout.reason")
  }
}
