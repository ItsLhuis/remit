import { faker } from "@faker-js/faker"

import { type InferInsertModel } from "drizzle-orm"

import { expenses } from "@/database/schema"

import { database } from "@/tests/integration/database"

export async function makeExpense(overrides?: Partial<InferInsertModel<typeof expenses>>) {
  const [expense] = await database
    .insert(expenses)
    .values({
      amountCents: faker.number.int({ min: 100, max: 500_000 }),
      currency: "EUR",
      category: faker.commerce.department(),
      description: faker.commerce.productDescription(),
      spentAt: new Date("2026-08-06T00:00:00.000Z"),
      ...overrides
    })
    .returning()

  if (!expense) throw new Error("makeExpense: insert failed")

  return expense
}
