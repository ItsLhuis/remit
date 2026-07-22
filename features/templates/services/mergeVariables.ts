import { z } from "zod"

import { LINE_ITEM_FIELDS, type Block, type LineItemField, type TemplateType } from "../schemas"

// Merge tokens are plain {{identifier.path}} references. The grammar allows only word characters and
// dots, so no expression, filter, pipe, or function call can be parsed - substitution is a direct
// dictionary lookup, never evaluation. Exported as a source string so each consumer builds its own
// stateful RegExp (the global flag makes a shared instance unsafe to reuse).
export const MERGE_TOKEN_SOURCE = "\\{\\{\\s*([\\w.]+)\\s*\\}\\}"

// Every identifier below is backed by a real database column (or a computed value derived from
// them, called out inline). Encrypted client notes and portal tokens are deliberately excluded;
// payment.iban is encrypted at rest and decrypted only by the server-side render-data builder.
// Values arrive pre-formatted as strings (money/date formatting happens at that boundary, with the
// instance locale and currency); the template stores tokens, never values.

const CLIENT_VARIABLES = [
  "client.name",
  "client.email",
  "client.phone",
  "client.website",
  "client.taxId",
  "client.addressLine1",
  "client.addressLine2",
  "client.city",
  "client.state",
  "client.postalCode",
  "client.country",
  "client.currency"
] as const

// The business logo is not a scalar: the image block's "businessLogo" source resolves
// settings.businessLogoUploadId through the assets map.
const BUSINESS_VARIABLES = [
  "business.name",
  "business.email",
  "business.phone",
  "business.website",
  "business.taxId",
  "business.addressLine1",
  "business.addressLine2",
  "business.city",
  "business.state",
  "business.postalCode",
  "business.country"
] as const

const PAYMENT_VARIABLES = [
  "payment.iban",
  "payment.bankName",
  "payment.instructions",
  "payment.termsDays"
] as const

// invoice.amountDue is computed (totalCents - amountPaidCents); everything else maps one-to-one.
const INVOICE_VARIABLES = [
  "invoice.number",
  "invoice.status",
  "invoice.currency",
  "invoice.subtotal",
  "invoice.discount",
  "invoice.tax",
  "invoice.total",
  "invoice.amountPaid",
  "invoice.amountDue",
  "invoice.issueDate",
  "invoice.dueDate",
  "invoice.paidAt",
  "invoice.notes",
  "invoice.lateFee",
  "invoice.exchangeRate"
] as const

const PROPOSAL_VARIABLES = [
  "proposal.number",
  "proposal.status",
  "proposal.currency",
  "proposal.subtotal",
  "proposal.discount",
  "proposal.tax",
  "proposal.total",
  "proposal.validUntil",
  "proposal.notes",
  "proposal.issueDate"
] as const

const CONTRACT_VARIABLES = [
  "contract.number",
  "contract.title",
  "contract.status",
  "contract.effectiveFrom",
  "contract.effectiveUntil",
  "contract.issuedAt",
  "contract.terminationReason"
] as const

const CREDIT_NOTE_VARIABLES = [
  "creditNote.number",
  "creditNote.reason",
  "creditNote.currency",
  "creditNote.subtotal",
  "creditNote.tax",
  "creditNote.total",
  "creditNote.issueDate"
] as const

export const ALL_MERGE_VARIABLES = [
  ...CLIENT_VARIABLES,
  ...BUSINESS_VARIABLES,
  ...PAYMENT_VARIABLES,
  ...INVOICE_VARIABLES,
  ...PROPOSAL_VARIABLES,
  ...CONTRACT_VARIABLES,
  ...CREDIT_NOTE_VARIABLES
] as const

export type MergeVariableId = (typeof ALL_MERGE_VARIABLES)[number]

export const MERGE_VARIABLES: Record<TemplateType, readonly MergeVariableId[]> = {
  invoice: [...CLIENT_VARIABLES, ...INVOICE_VARIABLES, ...BUSINESS_VARIABLES, ...PAYMENT_VARIABLES],
  proposal: [...CLIENT_VARIABLES, ...PROPOSAL_VARIABLES, ...BUSINESS_VARIABLES],
  contract: [...CLIENT_VARIABLES, ...CONTRACT_VARIABLES, ...BUSINESS_VARIABLES],
  credit_note: [
    ...CLIENT_VARIABLES,
    ...CREDIT_NOTE_VARIABLES,
    ...BUSINESS_VARIABLES,
    ...PAYMENT_VARIABLES
  ],
  email_invoice_send: [...CLIENT_VARIABLES, ...INVOICE_VARIABLES, ...BUSINESS_VARIABLES],
  email_proposal_send: [...CLIENT_VARIABLES, ...PROPOSAL_VARIABLES, ...BUSINESS_VARIABLES],
  email_contract_send: [...CLIENT_VARIABLES, ...CONTRACT_VARIABLES, ...BUSINESS_VARIABLES],
  email_payment_receipt: [...CLIENT_VARIABLES, ...INVOICE_VARIABLES, ...BUSINESS_VARIABLES],
  email_overdue_reminder: [...CLIENT_VARIABLES, ...INVOICE_VARIABLES, ...BUSINESS_VARIABLES],
  email_recurring_generated: [...CLIENT_VARIABLES, ...INVOICE_VARIABLES, ...BUSINESS_VARIABLES]
}

export function getMergeVariables(type: TemplateType): readonly MergeVariableId[] {
  return MERGE_VARIABLES[type]
}

function toMergeVariableEnum(variables: readonly MergeVariableId[]) {
  return z.enum(variables as [MergeVariableId, ...MergeVariableId[]])
}

// One Zod enum per template type, built from the same whitelist above, so token validation at save
// time (updateTemplate) is a safeParse against the real per-type grammar instead of ad-hoc Set
// membership.
const MERGE_VARIABLE_ENUMS: Record<TemplateType, ReturnType<typeof toMergeVariableEnum>> = {
  invoice: toMergeVariableEnum(MERGE_VARIABLES.invoice),
  proposal: toMergeVariableEnum(MERGE_VARIABLES.proposal),
  contract: toMergeVariableEnum(MERGE_VARIABLES.contract),
  credit_note: toMergeVariableEnum(MERGE_VARIABLES.credit_note),
  email_invoice_send: toMergeVariableEnum(MERGE_VARIABLES.email_invoice_send),
  email_proposal_send: toMergeVariableEnum(MERGE_VARIABLES.email_proposal_send),
  email_contract_send: toMergeVariableEnum(MERGE_VARIABLES.email_contract_send),
  email_payment_receipt: toMergeVariableEnum(MERGE_VARIABLES.email_payment_receipt),
  email_overdue_reminder: toMergeVariableEnum(MERGE_VARIABLES.email_overdue_reminder),
  email_recurring_generated: toMergeVariableEnum(MERGE_VARIABLES.email_recurring_generated)
}

// A line-item row as the render-data builder supplies it: every field pre-formatted, keyed by the
// lineItem.* binding ids a collection-bound table's columns use. These are bindings only - never
// scalar page tokens.
export type LineItemRenderRow = Partial<Record<LineItemField, unknown>>

// The typed render-data contract shared by the editor preview and later real-document callers.
// Scalars in `values` keep the whitelist/escape substitution path; `lineItems` feeds
// collection-bound table blocks.
export type TemplateRenderData = {
  values: Record<string, unknown>
  lineItems?: LineItemRenderRow[]
}

const SAMPLE_LINE_ITEM_COUNT = 3

// Editor preview data: every whitelisted variable renders as its own bracketed name so the user sees
// exactly where each token lands without real document data.
export function buildSampleRenderData(type: TemplateType): TemplateRenderData {
  const values = Object.fromEntries(
    getMergeVariables(type).map((variable) => [variable, `[${variable}]`])
  )

  const lineItems = Array.from({ length: SAMPLE_LINE_ITEM_COUNT }, () =>
    Object.fromEntries(LINE_ITEM_FIELDS.map((field) => [field, `[${field}]`]))
  )

  return { values, lineItems }
}

export function extractMergeTokens(blocks: readonly Block[]): string[] {
  const pattern = new RegExp(MERGE_TOKEN_SOURCE, "g")
  const tokens = new Set<string>()

  for (const source of collectTokenSources(blocks)) {
    for (const match of source.matchAll(pattern)) {
      const token = match[1]

      if (token) tokens.add(token)
    }
  }

  return [...tokens]
}

export function findUnknownTokens(blocks: readonly Block[], type: TemplateType): string[] {
  const schema = MERGE_VARIABLE_ENUMS[type]

  return extractMergeTokens(blocks).filter((token) => !schema.safeParse(token).success)
}

// The substitutable surfaces: text html, table headers, manual table cells, and the same surfaces
// inside frame and group children. Collection bindings are enum ids, not tokens, so they never
// appear here.
function collectTokenSources(blocks: readonly Block[]): string[] {
  const sources: string[] = []

  for (const block of blocks) {
    switch (block.type) {
      case "text":
        sources.push(block.content.html)
        break
      case "table":
        for (const column of block.content.columns) sources.push(column.header)

        if (block.content.source === "manual") {
          for (const row of block.content.rows) sources.push(...row.cells)
        }

        break
      case "frame":
      case "group":
        sources.push(...collectTokenSources(block.content.children))
        break
      case "image":
      case "shape":
        break
    }
  }

  return sources
}
