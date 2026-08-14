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

// The merge values an invoice document renders with, assembled from the invoice row and the records
// it points at. It mirrors `MERGE_VARIABLES.invoice` in
// `features/templates/services/mergeVariables.ts` exactly: every variable that type whitelists gets
// a key here, because a token whose key is missing renders as the raw `{{...}}` source instead of
// blank. The two lists have to be edited together.
//
// Pure by ADR-0007, and deliberately so: money formatting is the part of a document a reader checks
// first and the part a test can pin cheaply. Amounts arrive as integer minor units and are formatted
// once, here, so no caller can round a second time.

export type InvoiceRenderInvoice = {
  number: string
  currency: string
  subtotalCents: number
  discountAmountTotalCents: number
  taxAmountCents: number
  totalCents: number
  amountPaidCents: number
  lateFeeCents: number | null
  exchangeRate: string | null
  issueDate: Date | null
  dueDate: Date | null
  paidAt: Date | null
  notes: string | null
}

export type InvoiceRenderClient = MergeClient

export type InvoiceRenderBusiness = MergeBusiness

export type InvoiceRenderPayment = MergePayment

export type InvoiceRenderLineItem = {
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

export type InvoiceRenderDataInput = {
  invoice: InvoiceRenderInvoice
  client: InvoiceRenderClient | null
  business: InvoiceRenderBusiness
  payment: InvoiceRenderPayment
  lineItems: readonly InvoiceRenderLineItem[]
  // Already translated by the caller: the status is a domain enum and this function stays free of
  // the i18n singleton so it can be exercised without one.
  statusLabel: string
  locale: string
}

export function buildInvoiceRenderData({
  invoice,
  client,
  business,
  payment,
  lineItems,
  statusLabel,
  locale
}: InvoiceRenderDataInput): TemplateRenderData {
  const money = (cents: number): string => formatCurrency(cents, invoice.currency, locale)

  return {
    values: {
      ...buildClientMergeValues(client),
      "invoice.number": invoice.number,
      "invoice.status": statusLabel,
      "invoice.currency": invoice.currency,
      "invoice.subtotal": money(invoice.subtotalCents),
      "invoice.discount": money(invoice.discountAmountTotalCents),
      "invoice.tax": money(invoice.taxAmountCents),
      "invoice.total": money(invoice.totalCents),
      "invoice.amountPaid": money(invoice.amountPaidCents),
      // Computed, not stored: what the client still owes is the only figure a reminder or a payment
      // block may print, and a partly paid invoice must never show its face value as due.
      "invoice.amountDue": money(invoice.totalCents - invoice.amountPaidCents),
      "invoice.issueDate": mergeDay(invoice.issueDate, locale),
      "invoice.dueDate": mergeDay(invoice.dueDate, locale),
      "invoice.paidAt": mergeDay(invoice.paidAt, locale),
      "invoice.notes": mergeText(invoice.notes),
      "invoice.lateFee": invoice.lateFeeCents === null ? "" : money(invoice.lateFeeCents),
      "invoice.exchangeRate": mergeText(invoice.exchangeRate),
      ...buildBusinessMergeValues(business),
      ...buildPaymentMergeValues(payment)
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
// invoices with the same total look like they were discounted differently.
function lineItemDiscount(item: InvoiceRenderLineItem, money: (cents: number) => string): string {
  if (item.discountType === "percentage" && item.discountPercentage !== null) {
    return `${item.discountPercentage}%`
  }

  if (item.discountType === "fixed" && item.discountAmountCents !== null) {
    return money(item.discountAmountCents)
  }

  return ""
}
