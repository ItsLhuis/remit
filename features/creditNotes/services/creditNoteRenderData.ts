import { formatCurrency } from "@/lib/utils"

// The pure services entry rather than the feature barrel: that barrel re-exports components, which
// reach `lib/auth` and validate the environment at import time — a runtime dependency a pure service
// must not acquire (ADR-0007).
import {
  buildBusinessMergeValues,
  buildClientMergeValues,
  buildPaymentMergeValues,
  mergeDay,
  mergeText,
  type MergeBusiness,
  type MergeClient,
  type MergePayment,
  type TemplateRenderData
} from "@/features/templates/services"

// The merge values a credit note document renders with. It mirrors `MERGE_VARIABLES.credit_note` in
// `features/templates/services/mergeVariables.ts` exactly: every variable that type whitelists gets
// a key here, because a token whose key is missing renders as the raw `{{...}}` source instead of
// blank. The two lists have to be edited together.
//
// A credit note carries the `payment.*` group even though it takes no payment: it refunds one, and
// the bank details are how the money goes back. That is why the whitelist includes it here and not
// on a proposal.

export type CreditNoteRenderCreditNote = {
  number: string
  reason: string | null
  currency: string
  subtotalCents: number
  taxAmountCents: number
  totalCents: number
  issuedAt: Date | null
}

export type CreditNoteRenderClient = MergeClient

export type CreditNoteRenderBusiness = MergeBusiness

export type CreditNoteRenderPayment = MergePayment

export type CreditNoteRenderLineItem = {
  description: string
  unit: string | null
  quantity: string
  unitPriceCents: number
  taxPercentageSnapshot: string
  subtotalCents: number
  taxAmountCents: number
  totalCents: number
}

export type CreditNoteRenderDataInput = {
  creditNote: CreditNoteRenderCreditNote
  client: CreditNoteRenderClient | null
  business: CreditNoteRenderBusiness
  payment: CreditNoteRenderPayment
  lineItems: readonly CreditNoteRenderLineItem[]
  locale: string
}

export function buildCreditNoteRenderData({
  creditNote,
  client,
  business,
  payment,
  lineItems,
  locale
}: CreditNoteRenderDataInput): TemplateRenderData {
  const money = (cents: number): string => formatCurrency(cents, creditNote.currency, locale)

  return {
    values: {
      ...buildClientMergeValues(client),
      "creditNote.number": creditNote.number,
      "creditNote.reason": mergeText(creditNote.reason),
      "creditNote.currency": creditNote.currency,
      "creditNote.subtotal": money(creditNote.subtotalCents),
      "creditNote.tax": money(creditNote.taxAmountCents),
      "creditNote.total": money(creditNote.totalCents),
      "creditNote.issueDate": mergeDay(creditNote.issuedAt, locale),
      ...buildBusinessMergeValues(business),
      ...buildPaymentMergeValues(payment)
    },
    lineItems: lineItems.map((item) => ({
      "lineItem.description": item.description,
      "lineItem.unit": mergeText(item.unit),
      "lineItem.quantity": item.quantity,
      "lineItem.unitPrice": money(item.unitPriceCents),
      // A credit note's lines carry no discount of their own: the document is itself a reduction, and
      // `services/calculateCreditNoteTotal.ts` applies any document-level one. Binding a discount
      // column in a credit note template therefore renders blank rather than a stale invoice figure.
      "lineItem.discount": "",
      "lineItem.taxPercentage": `${item.taxPercentageSnapshot}%`,
      "lineItem.subtotal": money(item.subtotalCents),
      "lineItem.taxAmount": money(item.taxAmountCents),
      "lineItem.total": money(item.totalCents)
    }))
  }
}
