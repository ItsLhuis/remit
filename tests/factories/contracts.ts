import { faker } from "@faker-js/faker"

import { type InferInsertModel } from "drizzle-orm"

import { contracts } from "@/database/schema"

import { database } from "@/tests/integration/database"

import { makeTextBlock } from "./blocks"
import { makeClient } from "./clients"

export async function makeContract(overrides?: Partial<InferInsertModel<typeof contracts>>) {
  // A client parent by default: `chk_contracts_parent` needs one of the two, and a client-level
  // contract is the cheaper fixture (a project would pull a client in behind it anyway).
  const needsDefaultParent = !overrides?.projectId && !overrides?.clientId
  const clientId = needsDefaultParent ? (await makeClient()).id : (overrides?.clientId ?? null)

  const [contract] = await database
    .insert(contracts)
    .values({
      clientId,
      number: `CTR-${faker.string.alphanumeric(8).toUpperCase()}`,
      title: faker.commerce.productName(),
      status: "draft",
      blocks: [makeTextBlock()],
      publicToken: faker.string.alphanumeric(32),
      ...overrides
    })
    .returning()

  if (!contract) throw new Error("makeContract: insert failed")

  return contract
}
