import { faker } from "@faker-js/faker"

import { type InferInsertModel } from "drizzle-orm"

import { activityLogs } from "@/database/schema"

import { database } from "@/tests/integration/database"

export async function makeActivityLog(overrides?: Partial<InferInsertModel<typeof activityLogs>>) {
  const [activityLog] = await database
    .insert(activityLogs)
    .values({
      entityType: "client",
      entityId: faker.string.uuid(),
      action: "created",
      messageKey: "activity.messages.clientCreated",
      messageArgs: { name: faker.company.name() },
      ...overrides
    })
    .returning()

  if (!activityLog) throw new Error("makeActivityLog: insert failed")

  return activityLog
}
