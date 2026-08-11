import { faker } from "@faker-js/faker"

import { type InferInsertModel } from "drizzle-orm"

import { taxRates } from "@/database/schema"

import { database } from "@/tests/integration/database"

export async function makeTaxRate(overrides?: Partial<InferInsertModel<typeof taxRates>>) {
  const [taxRate] = await database
    .insert(taxRates)
    .values({
      name: faker.commerce.department(),
      percentage: "23",
      isDefault: false,
      ...overrides
    })
    .returning()

  if (!taxRate) throw new Error("makeTaxRate: insert failed")

  return taxRate
}
