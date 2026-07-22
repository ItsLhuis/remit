import { type TemplateType } from "../schemas"

export const TEMPLATE_CATEGORIES = [
  "invoice",
  "proposal",
  "contract",
  "credit_note",
  "email"
] as const

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number]

// Types whose rendered document carries a line-items collection; a line-items-bound table block is
// legal only on these.
const LINE_ITEM_TEMPLATE_TYPES: readonly TemplateType[] = [
  "invoice",
  "proposal",
  "credit_note",
  "email_invoice_send",
  "email_proposal_send",
  "email_payment_receipt",
  "email_overdue_reminder",
  "email_recurring_generated"
]

export function supportsLineItems(type: TemplateType): boolean {
  return LINE_ITEM_TEMPLATE_TYPES.includes(type)
}

export function getTemplateCategory(type: TemplateType): TemplateCategory {
  switch (type) {
    case "invoice":
      return "invoice"
    case "proposal":
      return "proposal"
    case "contract":
      return "contract"
    case "credit_note":
      return "credit_note"
    case "email_invoice_send":
    case "email_proposal_send":
    case "email_contract_send":
    case "email_payment_receipt":
    case "email_overdue_reminder":
    case "email_recurring_generated":
      return "email"
  }
}
