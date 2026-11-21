import { on } from "@/lib/events"

import { type ActivityRecord, findInvoiceNumber, record } from "./record"

export function subscribeInvoiceActivity(): void {
  on("invoice.sent", ({ invoiceId }) =>
    record("invoice.sent", () => buildInvoiceActivity(invoiceId, "sent", "invoiceSent"))
  )

  on("invoice.paid", ({ invoiceId }) =>
    record("invoice.paid", () => buildInvoiceActivity(invoiceId, "paid", "invoicePaid"))
  )

  on("invoice.overdue", ({ invoiceId, daysOverdue }) =>
    record("invoice.overdue", () => buildInvoiceOverdue(invoiceId, daysOverdue))
  )

  on("invoice.late_fee_applied", ({ invoiceId }) =>
    record("invoice.late_fee_applied", () => buildInvoiceLateFeeApplied(invoiceId))
  )
}

async function buildInvoiceActivity(
  invoiceId: string,
  action: string,
  message: "invoiceSent" | "invoicePaid"
): Promise<ActivityRecord | null> {
  const number = await findInvoiceNumber(invoiceId)

  if (number === null) return null

  return {
    entityType: "invoice",
    entityId: invoiceId,
    action,
    messageKey: `activity.messages.${message}`,
    messageArgs: { number }
  }
}

async function buildInvoiceOverdue(
  invoiceId: string,
  daysOverdue: number
): Promise<ActivityRecord | null> {
  const number = await findInvoiceNumber(invoiceId)

  if (number === null) return null

  return {
    entityType: "invoice",
    entityId: invoiceId,
    action: "overdue",
    messageKey: "activity.messages.invoiceOverdue",
    messageArgs: { number, days: daysOverdue }
  }
}

// The amount is left out of the message for the same reason `paymentReceived` leaves it out: the
// feed carries no currency, and a bare number beside an invoice in another currency reads as the
// wrong amount. The invoice itself states what was charged.
async function buildInvoiceLateFeeApplied(invoiceId: string): Promise<ActivityRecord | null> {
  const number = await findInvoiceNumber(invoiceId)

  if (number === null) return null

  return {
    entityType: "invoice",
    entityId: invoiceId,
    action: "late_fee_applied",
    messageKey: "activity.messages.invoiceLateFeeApplied",
    messageArgs: { number }
  }
}
