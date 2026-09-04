import { faker } from "@faker-js/faker"

import { type InferInsertModel } from "drizzle-orm"

import { mintPublicToken } from "@/lib/publicToken"

import { contracts } from "@/database/schema"

import { database } from "@/tests/integration/database"

import { makeTextBlock } from "./blocks"
import { makeClient } from "./clients"
import { resolveProjectClientId } from "./projectParent"

export async function makeContract(overrides?: Partial<InferInsertModel<typeof contracts>>) {
  // A client parent by default: `chk_contracts_parent` needs one of the two, and a client-level
  // contract is the cheaper fixture (a project would pull a client in behind it anyway).
  const needsDefaultParent = !overrides?.projectId && !overrides?.clientId
  const clientId = needsDefaultParent
    ? (await makeClient()).id
    : await resolveProjectClientId(overrides?.projectId, overrides?.clientId)

  const [contract] = await database
    .insert(contracts)
    .values({
      number: `CTR-${faker.string.alphanumeric(8).toUpperCase()}`,
      title: faker.commerce.productName(),
      status: "draft",
      blocks: [makeTextBlock()],
      publicToken: mintPublicToken(),
      ...overrides,
      clientId
    })
    .returning()

  if (!contract) throw new Error("makeContract: insert failed")

  return contract
}
