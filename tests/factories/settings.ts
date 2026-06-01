import { faker } from "@faker-js/faker"

import { type InferInsertModel } from "drizzle-orm"

import { settings } from "@/database/schema"

import { database } from "@/tests/integration/database"

export async function makeSettings(overrides?: Partial<InferInsertModel<typeof settings>>) {
  const [settingsRow] = await database
    .insert(settings)
    .values({
      businessName: faker.company.name(),
      defaultCurrency: "EUR",
      defaultLocale: "en",
      defaultTimezone: "UTC",
      ...overrides
    })
    .returning()

  if (!settingsRow) throw new Error("makeSettings: insert failed")

  return settingsRow
}
