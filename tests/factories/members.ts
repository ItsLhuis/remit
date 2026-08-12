import { type InferInsertModel } from "drizzle-orm"

import { members } from "@/database/schema"

import { database } from "@/tests/integration/database"

export async function makeMember(
  overrides: Partial<InferInsertModel<typeof members>> &
    Pick<InferInsertModel<typeof members>, "userId" | "organizationId">
) {
  const [member] = await database
    .insert(members)
    .values({
      role: "assistant",
      ...overrides
    })
    .returning()

  if (!member) throw new Error("makeMember: insert failed")

  return member
}
