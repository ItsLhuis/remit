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

// What is still owed, in integer cents. Clamped at zero so an over-application recorded by a future
// payment path can never render as a negative amount due.
export function getInvoiceOutstandingCents(
  invoice: Pick<InvoiceStatusViewInput, "amountPaidCents" | "totalCents">
): number {
  return Math.max(invoice.totalCents - invoice.amountPaidCents, 0)
}

function toUtcDayValue(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
}
