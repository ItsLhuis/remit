import { type InvoiceStatus, type InvoiceViewStatus } from "../schemas"

export type InvoiceStatusViewInput = {
  status: InvoiceStatus
  dueDate: Date | null
  paidAt: Date | null
  amountPaidCents: number
  totalCents: number
}

// `overdue` and `partially_paid` are never written to `invoices.status` — the stored machine has
// exactly three values (SCHEMA.md, enum reference). They are derived here, once, and every surface
// that shows a status badge reads this function so no two of them can disagree.
//
// Precedence, highest first:
//
//   paid           — settled, so neither of the other two can apply
//   overdue        — the due date has passed with no payment recorded in full; this is what the
//                    freelancer needs to see first, so it outranks a partial payment
//   partially_paid — money has arrived but not all of it
//   the stored status otherwise
//
// `overdue` compares UTC date-only values against the stored `date` column, so an instance in any
// zone agrees about which day it is, and it is inclusive of the due day itself: an invoice due today
// is not yet late.
export function deriveInvoiceStatusView(
  invoice: InvoiceStatusViewInput,
  now: Date
): InvoiceViewStatus {
  if (invoice.status === "paid") return "paid"

  if (isInvoiceOverdue(invoice, now)) return "overdue"

  if (isInvoicePartiallyPaid(invoice)) return "partially_paid"

  return invoice.status
}

export function isInvoiceOverdue(
  invoice: Pick<InvoiceStatusViewInput, "status" | "dueDate" | "paidAt">,
  now: Date
): boolean {
  if (invoice.status === "draft") return false
  if (!invoice.dueDate || invoice.paidAt) return false

  return toUtcDayValue(now) > toUtcDayValue(invoice.dueDate)
}

export function isInvoicePartiallyPaid(
  invoice: Pick<InvoiceStatusViewInput, "amountPaidCents" | "totalCents">
): boolean {
  return invoice.amountPaidCents > 0 && invoice.amountPaidCents < invoice.totalCents
}

export type InvoiceOutstandingInput = {
  totalCents: number
  amountPaidCents: number
  // The sum of the live credit notes issued against the invoice.
  creditedCents: number
}

// What the client still owes, in integer cents — the one definition every surface that shows,
// charges or exposes it reads, so the invoice page, the portal, checkout and the API cannot quote
// two amounts for one invoice.
//
// A credit note nets here rather than in `total_cents`: the total is what the issued document said
// and is never rewritten by a correction (`features/creditNotes/services/effectiveReceivable.ts`),
// while a late fee is already inside the total (ADR-0033) and must not be added a second time.
// `features/payments/services/paymentSettlement.ts` settles an invoice exactly when this reaches
// zero, which is what keeps a settled invoice from reading as owing money.
//
// Clamped at zero: an invoice credited beyond what was left to pay leaves nothing outstanding, not a
// negative balance to chase.
export function getInvoiceOutstandingCents(invoice: InvoiceOutstandingInput): number {
  return Math.max(invoice.totalCents - invoice.creditedCents - invoice.amountPaidCents, 0)
}

function toUtcDayValue(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
}
