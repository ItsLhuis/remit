import { type IconProps } from "@/components/ui"

import {
  type Block,
  type BlockType,
  type LineItemField,
  type TemplateFontKey,
  type TemplateType
} from "./schemas"
import { type MergeVariableId } from "./services"

export const TEMPLATE_TYPE_LABEL_KEYS = {
  invoice: "templates.types.invoice",
  proposal: "templates.types.proposal",
  contract: "templates.types.contract",
  credit_note: "templates.types.credit_note",
  email_invoice_send: "templates.types.email_invoice_send",
  email_proposal_send: "templates.types.email_proposal_send",
  email_contract_send: "templates.types.email_contract_send",
  email_payment_receipt: "templates.types.email_payment_receipt",
  email_overdue_reminder: "templates.types.email_overdue_reminder",
  email_recurring_generated: "templates.types.email_recurring_generated"
} as const satisfies Record<TemplateType, string>

// The type badge carries no colour of its own - a template type is a classification, not a state,
// and the design system reserves semantic tints for state. The icon is what distinguishes one type
// from another, so every type needs a distinct one.
export const TEMPLATE_TYPE_ICON_NAMES = {
  invoice: "ReceiptText",
  proposal: "FileText",
  contract: "FileSignature",
  credit_note: "FileMinus",
  email_invoice_send: "Mail",
  email_proposal_send: "Mails",
  email_contract_send: "MailOpen",
  email_payment_receipt: "MailCheck",
  email_overdue_reminder: "MailWarning",
  email_recurring_generated: "MailPlus"
} as const satisfies Record<TemplateType, IconProps["name"]>

export const BLOCK_LABEL_KEYS = {
  text: "templates.blocks.text",
  image: "templates.blocks.image",
  table: "templates.blocks.table",
  frame: "templates.blocks.frame",
  group: "templates.blocks.group",
  shape: "templates.blocks.shape"
} as const satisfies Record<BlockType, string>

export const BLOCK_ICON_NAMES = {
  text: "Type",
  image: "Image",
  table: "Table",
  frame: "Frame",
  group: "Group",
  shape: "Shapes"
} as const satisfies Record<BlockType, IconProps["name"]>

export const SHAPE_VARIANT_LABEL_KEYS = {
  rectangle: "templates.blocks.shapeVariant.rectangle",
  ellipse: "templates.blocks.shapeVariant.ellipse",
  line: "templates.blocks.shapeVariant.line"
} as const satisfies Record<Extract<Block, { type: "shape" }>["content"]["variant"], string>

export const SHAPE_VARIANT_ICON_NAMES = {
  rectangle: "Square",
  ellipse: "Circle",
  line: "Minus"
} as const satisfies Record<
  Extract<Block, { type: "shape" }>["content"]["variant"],
  IconProps["name"]
>

export const TEMPLATE_FONT_LABEL_KEYS = {
  sans: "templates.pageSettings.fonts.sans",
  serif: "templates.pageSettings.fonts.serif",
  mono: "templates.pageSettings.fonts.mono"
} as const satisfies Record<TemplateFontKey, string>

// Every whitelisted merge identifier carries a human-readable label key; the picker and every
// other surface show these labels, never the raw {{token}} syntax. The satisfies clause keeps the
// map exhaustive over MERGE_VARIABLES - adding an identifier without a label fails to compile.
export const MERGE_VARIABLE_LABEL_KEYS = {
  "client.name": "templates.mergeVariables.labels.clientName",
  "client.email": "templates.mergeVariables.labels.clientEmail",
  "client.phone": "templates.mergeVariables.labels.clientPhone",
  "client.website": "templates.mergeVariables.labels.clientWebsite",
  "client.taxId": "templates.mergeVariables.labels.clientTaxId",
  "client.addressLine1": "templates.mergeVariables.labels.clientAddressLine1",
  "client.addressLine2": "templates.mergeVariables.labels.clientAddressLine2",
  "client.city": "templates.mergeVariables.labels.clientCity",
  "client.state": "templates.mergeVariables.labels.clientState",
  "client.postalCode": "templates.mergeVariables.labels.clientPostalCode",
  "client.country": "templates.mergeVariables.labels.clientCountry",
  "client.currency": "templates.mergeVariables.labels.clientCurrency",
  "business.name": "templates.mergeVariables.labels.businessName",
  "business.email": "templates.mergeVariables.labels.businessEmail",
  "business.phone": "templates.mergeVariables.labels.businessPhone",
  "business.website": "templates.mergeVariables.labels.businessWebsite",
  "business.taxId": "templates.mergeVariables.labels.businessTaxId",
  "business.addressLine1": "templates.mergeVariables.labels.businessAddressLine1",
  "business.addressLine2": "templates.mergeVariables.labels.businessAddressLine2",
  "business.city": "templates.mergeVariables.labels.businessCity",
  "business.state": "templates.mergeVariables.labels.businessState",
  "business.postalCode": "templates.mergeVariables.labels.businessPostalCode",
  "business.country": "templates.mergeVariables.labels.businessCountry",
  "payment.iban": "templates.mergeVariables.labels.paymentIban",
  "payment.bankName": "templates.mergeVariables.labels.paymentBankName",
  "payment.instructions": "templates.mergeVariables.labels.paymentInstructions",
  "payment.termsDays": "templates.mergeVariables.labels.paymentTermsDays",
  "invoice.number": "templates.mergeVariables.labels.invoiceNumber",
  "invoice.status": "templates.mergeVariables.labels.invoiceStatus",
  "invoice.currency": "templates.mergeVariables.labels.invoiceCurrency",
  "invoice.subtotal": "templates.mergeVariables.labels.invoiceSubtotal",
  "invoice.discount": "templates.mergeVariables.labels.invoiceDiscount",
  "invoice.tax": "templates.mergeVariables.labels.invoiceTax",
  "invoice.total": "templates.mergeVariables.labels.invoiceTotal",
  "invoice.amountPaid": "templates.mergeVariables.labels.invoiceAmountPaid",
  "invoice.amountDue": "templates.mergeVariables.labels.invoiceAmountDue",
  "invoice.issueDate": "templates.mergeVariables.labels.invoiceIssueDate",
  "invoice.dueDate": "templates.mergeVariables.labels.invoiceDueDate",
  "invoice.paidAt": "templates.mergeVariables.labels.invoicePaidAt",
  "invoice.notes": "templates.mergeVariables.labels.invoiceNotes",
  "invoice.lateFee": "templates.mergeVariables.labels.invoiceLateFee",
  "invoice.exchangeRate": "templates.mergeVariables.labels.invoiceExchangeRate",
  "proposal.number": "templates.mergeVariables.labels.proposalNumber",
  "proposal.status": "templates.mergeVariables.labels.proposalStatus",
  "proposal.currency": "templates.mergeVariables.labels.proposalCurrency",
  "proposal.subtotal": "templates.mergeVariables.labels.proposalSubtotal",
  "proposal.discount": "templates.mergeVariables.labels.proposalDiscount",
  "proposal.tax": "templates.mergeVariables.labels.proposalTax",
  "proposal.total": "templates.mergeVariables.labels.proposalTotal",
  "proposal.validUntil": "templates.mergeVariables.labels.proposalValidUntil",
  "proposal.notes": "templates.mergeVariables.labels.proposalNotes",
  "proposal.issueDate": "templates.mergeVariables.labels.proposalIssueDate",
  "contract.number": "templates.mergeVariables.labels.contractNumber",
  "contract.title": "templates.mergeVariables.labels.contractTitle",
  "contract.status": "templates.mergeVariables.labels.contractStatus",
  "contract.effectiveFrom": "templates.mergeVariables.labels.contractEffectiveFrom",
  "contract.effectiveUntil": "templates.mergeVariables.labels.contractEffectiveUntil",
  "contract.issuedAt": "templates.mergeVariables.labels.contractIssuedAt",
  "contract.terminationReason": "templates.mergeVariables.labels.contractTerminationReason",
  "creditNote.number": "templates.mergeVariables.labels.creditNoteNumber",
  "creditNote.reason": "templates.mergeVariables.labels.creditNoteReason",
  "creditNote.currency": "templates.mergeVariables.labels.creditNoteCurrency",
  "creditNote.subtotal": "templates.mergeVariables.labels.creditNoteSubtotal",
  "creditNote.tax": "templates.mergeVariables.labels.creditNoteTax",
  "creditNote.total": "templates.mergeVariables.labels.creditNoteTotal",
  "creditNote.issueDate": "templates.mergeVariables.labels.creditNoteIssueDate"
} as const satisfies Record<MergeVariableId, string>

// Line-item fields are table-column bindings, never scalar page tokens; the binding select shows
// these labels.
export const LINE_ITEM_FIELD_LABEL_KEYS = {
  "lineItem.description": "templates.mergeVariables.labels.lineItemDescription",
  "lineItem.unit": "templates.mergeVariables.labels.lineItemUnit",
  "lineItem.quantity": "templates.mergeVariables.labels.lineItemQuantity",
  "lineItem.unitPrice": "templates.mergeVariables.labels.lineItemUnitPrice",
  "lineItem.discount": "templates.mergeVariables.labels.lineItemDiscount",
  "lineItem.taxPercentage": "templates.mergeVariables.labels.lineItemTaxPercentage",
  "lineItem.subtotal": "templates.mergeVariables.labels.lineItemSubtotal",
  "lineItem.taxAmount": "templates.mergeVariables.labels.lineItemTaxAmount",
  "lineItem.total": "templates.mergeVariables.labels.lineItemTotal"
} as const satisfies Record<LineItemField, string>
