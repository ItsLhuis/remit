import { faker } from "@faker-js/faker"

import { type InferInsertModel } from "drizzle-orm"

import { users } from "@/database/schema"

import { database } from "@/tests/integration/database"

export async function makeUser(overrides?: Partial<InferInsertModel<typeof users>>) {
  const [user] = await database
    .insert(users)
    .values({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      emailVerified: false,
      twoFactorEnabled: false,
      ...overrides
    })
    .returning()

  if (!user) throw new Error("makeUser: insert failed")

  return user
}
