import { faker } from "@faker-js/faker"

import { type InferInsertModel } from "drizzle-orm"

import { clientContacts } from "@/database/schema"

import { database } from "@/tests/integration/database"

import { makeClient } from "./clients"

export async function makeClientContact(
  overrides?: Partial<InferInsertModel<typeof clientContacts>>
) {
  const clientId = overrides?.clientId ?? (await makeClient()).id

  const [contact] = await database
    .insert(clientContacts)
    .values({
      clientId,
      name: faker.person.fullName(),
      email: faker.internet.email(),
      ...overrides
    })
    .returning()

  if (!contact) throw new Error("makeClientContact: insert failed")

  return contact
}
