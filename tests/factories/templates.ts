import { faker } from "@faker-js/faker"

import { type InferInsertModel } from "drizzle-orm"

import { templates } from "@/database/schema"

import { database } from "@/tests/integration/database"

export async function makeTemplate(overrides?: Partial<InferInsertModel<typeof templates>>) {
  const [template] = await database
    .insert(templates)
    .values({
      name: faker.commerce.productName(),
      type: "invoice",
      blocks: [],
      ...overrides
    })
    .returning()

  if (!template) throw new Error("makeTemplate: insert failed")

  return template
}
