import { faker } from "@faker-js/faker"

import { type InferInsertModel } from "drizzle-orm"

import { creditNotes } from "@/database/schema"

import { database } from "@/tests/integration/database"

import { makeInvoice } from "./invoices"

export async function makeCreditNote(overrides?: Partial<InferInsertModel<typeof creditNotes>>) {
  const invoiceId = overrides?.invoiceId ?? (await makeInvoice({ status: "sent" })).id

  const [creditNote] = await database
    .insert(creditNotes)
    .values({
      invoiceId,
      number: `CN-${faker.string.alphanumeric(8).toUpperCase()}`,
      currency: "EUR",
      subtotalCents: 10000,
      taxAmountCents: 0,
      totalCents: 10000,
      ...overrides
    })
    .returning()

  if (!creditNote) throw new Error("makeCreditNote: insert failed")

  return creditNote
}
