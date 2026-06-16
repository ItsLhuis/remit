import { faker } from "@faker-js/faker"

import { type InferInsertModel } from "drizzle-orm"

import { leads } from "@/database/schema"

import { database } from "@/tests/integration/database"

export async function makeLead(overrides?: Partial<InferInsertModel<typeof leads>>) {
  const [lead] = await database
    .insert(leads)
    .values({
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      email: faker.internet.email(),
      ...overrides
    })
    .returning()

  if (!lead) throw new Error("makeLead: insert failed")

  return lead
}
