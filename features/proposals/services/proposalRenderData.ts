import { formatCurrency } from "@/lib/utils"

// The pure services entry rather than the feature barrel: that barrel re-exports components, which
// reach `lib/auth` and validate the environment at import time — a runtime dependency a pure service
// must not acquire (ADR-0007).
import {
  buildBusinessMergeValues,
  buildClientMergeValues,
  mergeDay,
  mergeText,
  type MergeBusiness,
  type MergeClient,
  type TemplateRenderData
} from "@/features/templates/services"

// The merge values a proposal document renders with. It mirrors `MERGE_VARIABLES.proposal` in
// `features/templates/services/mergeVariables.ts` exactly: every variable that type whitelists gets
// a key here, because a token whose key is missing renders as the raw `{{...}}` source instead of
// blank. The two lists have to be edited together.
//
// No `payment.*` group, unlike an invoice: a proposal is not payable, and the whitelist for this
// type says so. Adding one here would put bank details on a document that never asks for money.

export type ProposalRenderProposal = {
  number: string
  currency: string
  subtotalCents: number
  discountAmountTotalCents: number
  taxAmountCents: number
  totalCents: number
  validUntil: Date | null
  issuedAt: Date | null
  notes: string | null
}

export type ProposalRenderClient = MergeClient

export type ProposalRenderBusiness = MergeBusiness

export type ProposalRenderLineItem = {
  description: string
  unit: string | null
  quantity: string
  unitPriceCents: number
  discountType: "percentage" | "fixed" | null
  discountPercentage: string | null
  discountAmountCents: number | null
  taxPercentageSnapshot: string
  subtotalCents: number
  taxAmountCents: number
  totalCents: number
}

export type ProposalRenderDataInput = {
  proposal: ProposalRenderProposal
  client: ProposalRenderClient | null
  business: ProposalRenderBusiness
  lineItems: readonly ProposalRenderLineItem[]
  // Already translated by the caller: the status is a domain enum and this function stays free of
  // the i18n singleton so it can be exercised without one.
  statusLabel: string
  locale: string
}

export function buildProposalRenderData({
  proposal,
  client,
  business,
  lineItems,
  statusLabel,
  locale
}: ProposalRenderDataInput): TemplateRenderData {
  const money = (cents: number): string => formatCurrency(cents, proposal.currency, locale)

  return {
    values: {
      ...buildClientMergeValues(client),
      "proposal.number": proposal.number,
      "proposal.status": statusLabel,
      "proposal.currency": proposal.currency,
      "proposal.subtotal": money(proposal.subtotalCents),
      "proposal.discount": money(proposal.discountAmountTotalCents),
      "proposal.tax": money(proposal.taxAmountCents),
      "proposal.total": money(proposal.totalCents),
      "proposal.validUntil": mergeDay(proposal.validUntil, locale),
      "proposal.issueDate": mergeDay(proposal.issuedAt, locale),
      "proposal.notes": mergeText(proposal.notes),
      ...buildBusinessMergeValues(business)
    },
    lineItems: lineItems.map((item) => ({
      "lineItem.description": item.description,
      "lineItem.unit": mergeText(item.unit),
      "lineItem.quantity": item.quantity,
      "lineItem.unitPrice": money(item.unitPriceCents),
      "lineItem.discount": lineItemDiscount(item, money),
      "lineItem.taxPercentage": `${item.taxPercentageSnapshot}%`,
      "lineItem.subtotal": money(item.subtotalCents),
      "lineItem.taxAmount": money(item.taxAmountCents),
      "lineItem.total": money(item.totalCents)
    }))
  }
}

// A percentage discount prints as a percentage and a fixed one as money, because that is what the
// line was authored as. Rendering a percentage line as its computed cash value would make two
// documents with the same total look like they were discounted differently.
function lineItemDiscount(item: ProposalRenderLineItem, money: (cents: number) => string): string {
  if (item.discountType === "percentage" && item.discountPercentage !== null) {
    return `${item.discountPercentage}%`
  }

  if (item.discountType === "fixed" && item.discountAmountCents !== null) {
    return money(item.discountAmountCents)
  }

  return ""
}
