import { faker } from "@faker-js/faker"

import { type InferInsertModel } from "drizzle-orm"

import { timeEntries } from "@/database/schema"

import { database } from "@/tests/integration/database"

import { makeProject } from "./projects"

export async function makeTimeEntry(overrides?: Partial<InferInsertModel<typeof timeEntries>>) {
  const projectId = overrides?.projectId ?? (await makeProject()).id
  const startedAt = overrides?.startedAt ?? faker.date.recent()

  const [timeEntry] = await database
    .insert(timeEntries)
    .values({
      projectId,
      startedAt,
      endedAt: new Date(startedAt.getTime() + 3_600_000),
      durationSeconds: 3600,
      hourlyRateSnapshotCents: 10_000,
      ...overrides
    })
    .returning()

  if (!timeEntry) throw new Error("makeTimeEntry: insert failed")

  return timeEntry
}
