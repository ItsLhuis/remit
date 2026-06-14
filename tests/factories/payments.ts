import { type InferInsertModel } from "drizzle-orm"

import { payments } from "@/database/schema"

import { database } from "@/tests/integration/database"

import { makeInvoice } from "./invoices"

export async function makePayment(overrides?: Partial<InferInsertModel<typeof payments>>) {
  const invoiceId = overrides?.invoiceId ?? (await makeInvoice()).id

  const [payment] = await database
    .insert(payments)
    .values({
      invoiceId,
      method: "bank_transfer",
      amountCents: 1000,
      currency: "EUR",
      ...overrides
    })
    .returning()

  if (!payment) throw new Error("makePayment: insert failed")

  return payment
}
