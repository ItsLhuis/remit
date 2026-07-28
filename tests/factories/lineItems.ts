import { faker } from "@faker-js/faker"

import { type InferInsertModel } from "drizzle-orm"

import { lineItems } from "@/database/schema"

import { database } from "@/tests/integration/database"

import { makeProposal } from "./proposals"

export async function makeLineItem(overrides?: Partial<InferInsertModel<typeof lineItems>>) {
  const needsParent = !overrides?.proposalId && !overrides?.invoiceId && !overrides?.creditNoteId
  const proposalId = needsParent ? (await makeProposal()).id : overrides?.proposalId

  const [lineItem] = await database
    .insert(lineItems)
    .values({
      proposalId,
      position: 0,
      description: faker.lorem.words(4),
      quantity: "1",
      unitPriceCents: 10000,
      taxPercentageSnapshot: "0",
      subtotalCents: 10000,
      taxAmountCents: 0,
      totalCents: 10000,
      ...overrides
    })
    .returning()

  if (!lineItem) throw new Error("makeLineItem: insert failed")

  return lineItem
}
