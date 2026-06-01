import { faker } from "@faker-js/faker"

import { type InferInsertModel } from "drizzle-orm"

import { organizations } from "@/database/schema"

import { database } from "@/tests/integration/database"

export async function makeOrganization(
  overrides?: Partial<InferInsertModel<typeof organizations>>
) {
  const name = overrides?.name ?? faker.company.name()

  const [organization] = await database
    .insert(organizations)
    .values({
      name,
      slug: faker.helpers.slugify(name).toLowerCase(),
      ...overrides
    })
    .returning()

  if (!organization) throw new Error("makeOrganization: insert failed")

  return organization
}
