import { faker } from "@faker-js/faker"

import { type InferInsertModel } from "drizzle-orm"

import { clients } from "@/database/schema"

import { database } from "@/tests/integration/database"

export async function makeClient(overrides?: Partial<InferInsertModel<typeof clients>>) {
  const [client] = await database
    .insert(clients)
    .values({
      name: faker.company.name(),
      email: faker.internet.email(),
      ...overrides
    })
    .returning()

  if (!client) throw new Error("makeClient: insert failed")

  return client
}
