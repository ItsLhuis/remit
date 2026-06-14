import { faker } from "@faker-js/faker"

import { type InferInsertModel } from "drizzle-orm"

import { proposals } from "@/database/schema"

import { database } from "@/tests/integration/database"

import { makeProject } from "./projects"

export async function makeProposal(overrides?: Partial<InferInsertModel<typeof proposals>>) {
  const projectId = overrides?.projectId ?? (await makeProject()).id

  const [proposal] = await database
    .insert(proposals)
    .values({
      projectId,
      number: `PROP-${faker.string.alphanumeric(8).toUpperCase()}`,
      status: "draft",
      currency: "EUR",
      publicToken: faker.string.alphanumeric(32),
      subtotalCents: 0,
      discountAmountTotalCents: 0,
      taxAmountCents: 0,
      totalCents: 0,
      viewCount: 0,
      ...overrides
    })
    .returning()

  if (!proposal) throw new Error("makeProposal: insert failed")

  return proposal
}
