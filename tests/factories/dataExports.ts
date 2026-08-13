import { type InferInsertModel } from "drizzle-orm"

import { dataExports } from "@/database/schema"

import { database } from "@/tests/integration/database"

export async function makeDataExport(overrides?: Partial<InferInsertModel<typeof dataExports>>) {
  const [dataExport] = await database
    .insert(dataExports)
    .values({
      scope: "instance",
      status: "pending",
      ...overrides
    })
    .returning()

  if (!dataExport) throw new Error("makeDataExport: insert failed")

  return dataExport
}
