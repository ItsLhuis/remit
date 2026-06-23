import { faker } from "@faker-js/faker"

import { type InferInsertModel } from "drizzle-orm"

import { tasks } from "@/database/schema"

import { database } from "@/tests/integration/database"

import { makeProject } from "./projects"

export async function makeTask(overrides?: Partial<InferInsertModel<typeof tasks>>) {
  const projectId = overrides?.projectId ?? (await makeProject()).id

  const [task] = await database
    .insert(tasks)
    .values({
      projectId,
      title: faker.lorem.words(3),
      status: "todo",
      priority: "normal",
      ...overrides
    })
    .returning()

  if (!task) throw new Error("makeTask: insert failed")

  return task
}
