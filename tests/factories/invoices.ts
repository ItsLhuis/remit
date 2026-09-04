import { faker } from "@faker-js/faker"

import { type InferInsertModel } from "drizzle-orm"

import { mintPublicToken } from "@/lib/publicToken"

import { invoices } from "@/database/schema"

import { database } from "@/tests/integration/database"

import { makeClient } from "./clients"
import { resolveProjectClientId } from "./projectParent"

export async function makeInvoice(overrides?: Partial<InferInsertModel<typeof invoices>>) {
  const needsParent = !overrides?.projectId && !overrides?.clientId
  const clientId = needsParent
    ? (await makeClient()).id
    : await resolveProjectClientId(overrides?.projectId, overrides?.clientId)

  const [invoice] = await database
    .insert(invoices)
    .values({
      number: `INV-${faker.string.alphanumeric(8).toUpperCase()}`,
      status: "draft",
      currency: "EUR",
      publicToken: mintPublicToken(),
      subtotalCents: 0,
      discountAmountTotalCents: 0,
      taxAmountCents: 0,
      totalCents: 0,
      amountPaidCents: 0,
      viewCount: 0,
      ...overrides,
      clientId
    })
    .returning()

  if (!invoice) throw new Error("makeInvoice: insert failed")

  return invoice
}
