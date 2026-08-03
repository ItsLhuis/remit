import { and, desc, eq, isNull } from "drizzle-orm"

import { database } from "@/database"
import { payments } from "@/database/schema"

import { invoicePaymentsParamsSchema } from "./schemas"
import { type PaymentListItem } from "./types"

type PaymentRow = typeof payments.$inferSelect

// Newest receipt first, with `createdAt` breaking the tie so two payments filed on the same day keep
// the order they were entered in rather than an arbitrary one.
export async function listInvoicePayments(input: unknown): Promise<PaymentListItem[]> {
  const parsed = invoicePaymentsParamsSchema.safeParse(input)

  if (!parsed.success) return []

  const rows = await database
    .select()
    .from(payments)
    .where(and(eq(payments.invoiceId, parsed.data.invoiceId), isNull(payments.deletedAt)))
    .orderBy(desc(payments.paidAt), desc(payments.createdAt))

  return rows.map(toPaymentListItem)
}

function toPaymentListItem(row: PaymentRow): PaymentListItem {
  return {
    id: row.id,
    invoiceId: row.invoiceId,
    method: row.method,
    amountCents: Number(row.amountCents),
    currency: row.currency,
    paidAt: row.paidAt,
    reference: row.reference ?? "",
    notes: row.notes ?? ""
  }
}
