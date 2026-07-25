import { TEMPLATE_TYPES, type TemplateType } from "../schemas"

import { getTemplateCategory } from "./templateCategories"

export type TemplateSummaryRow = {
  type: TemplateType
  isSystem: boolean
  isDefault: boolean
}

export type TemplatesSummary = {
  total: number
  custom: number
  system: number
  documents: number
  emails: number
  byType: Record<TemplateType, number>
  coveredTypes: number
  totalTypes: number
}

// Written as a literal rather than derived from TEMPLATE_TYPES so the compiler checks the map is
// exhaustive; a new template type fails to build until it is counted here.
function emptyTypeCounts(): Record<TemplateType, number> {
  return {
    invoice: 0,
    proposal: 0,
    contract: 0,
    credit_note: 0,
    email_invoice_send: 0,
    email_proposal_send: 0,
    email_contract_send: 0,
    email_payment_receipt: 0,
    email_overdue_reminder: 0,
    email_recurring_generated: 0
  }
}

export function summarizeTemplates(rows: TemplateSummaryRow[]): TemplatesSummary {
  const byType = emptyTypeCounts()

  // A type is covered when one of its templates is flagged default; anything uncovered renders
  // through the built-in layout instead, which is the actionable half of this summary.
  const coveredTypes = new Set<TemplateType>()

  const summary: TemplatesSummary = {
    total: 0,
    custom: 0,
    system: 0,
    documents: 0,
    emails: 0,
    byType,
    coveredTypes: 0,
    totalTypes: TEMPLATE_TYPES.length
  }

  for (const row of rows) {
    summary.total += 1

    byType[row.type] += 1

    if (row.isSystem) summary.system += 1
    else summary.custom += 1

    if (getTemplateCategory(row.type) === "email") summary.emails += 1
    else summary.documents += 1

    if (row.isDefault) coveredTypes.add(row.type)
  }

  summary.coveredTypes = coveredTypes.size

  return summary
}
