import { faker } from "@faker-js/faker"

import { type InferInsertModel } from "drizzle-orm"

import { projects } from "@/database/schema"

import { database } from "@/tests/integration/database"

import { makeClient } from "./clients"

export async function makeProject(overrides?: Partial<InferInsertModel<typeof projects>>) {
  const clientId = overrides?.clientId ?? (await makeClient()).id

  const [project] = await database
    .insert(projects)
    .values({
      clientId,
      name: faker.commerce.productName(),
      status: "active",
      ...overrides
    })
    .returning()

  if (!project) throw new Error("makeProject: insert failed")

  return project
}
