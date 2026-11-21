import { eq } from "drizzle-orm"

import { on } from "@/lib/events"

import { database } from "@/database"
import { payments } from "@/database/schema"

import { type ActivityRecord, findInvoiceNumber, record } from "./record"

export function subscribePaymentActivity(): void {
  on("payment.received", ({ paymentId, invoiceId }) =>
    record("payment.received", () => buildPaymentReceived(paymentId, invoiceId))
  )
}

// Filed under the payment rather than the invoice it settles, so the invoice's own timeline is not
// buried by a part-payment schedule and the entry can link back to the row that was recorded.
async function buildPaymentReceived(
  paymentId: string,
  invoiceId: string
): Promise<ActivityRecord | null> {
  const [payment, number] = await Promise.all([
    database.query.payments.findFirst({
      where: eq(payments.id, paymentId),
      columns: { id: true }
    }),
    findInvoiceNumber(invoiceId)
  ])

  if (!payment || number === null) return null

  return {
    entityType: "payment",
    entityId: paymentId,
    action: "received",
    messageKey: "activity.messages.paymentReceived",
    messageArgs: { number }
  }
}
