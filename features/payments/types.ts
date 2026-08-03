import { type PaymentFormInputValues, type PaymentMethod } from "./schemas"

// One recorded receipt against an invoice. `currency` travels with the row rather than being taken
// from the invoice at render time, because a payment is a historical record: it keeps the currency
// it was written in even if the invoice is later edited.
export type PaymentListItem = {
  id: string
  invoiceId: string
  method: PaymentMethod
  amountCents: number
  currency: string
  paidAt: Date
  reference: string
  notes: string
}

export type PaymentFormData = PaymentFormInputValues & { id: string }

// Who is performing a payment write, resolved by the caller's own auth gate. Passed across the
// feature boundary so `recordInvoiceSettlement` can write the payment audit entry under the actor
// that triggered the invoice-side action.
export type PaymentActor = {
  userId: string
  role: "owner" | "accountant" | "assistant"
  ipAddress: string | null
  userAgent: string | null
}

export type PaymentMutationResult = { data: { id: string } } | { error: string }

// Reported back to the invoice-side caller so it can decide whether the invoice reached `paid` and
// therefore whether `invoice.paid` should be emitted.
export type InvoiceSettlementResult =
  | { data: { paymentId: string; settled: boolean } }
  | { error: string }
