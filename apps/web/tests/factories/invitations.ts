import { faker } from "@faker-js/faker"

import { type InferInsertModel } from "drizzle-orm"

import { invitations } from "@/database/schema"

import { database } from "@/tests/integration/database"

const INVITATION_TTL_MS = 48 * 60 * 60 * 1000

export async function makeInvitation(
  overrides: Partial<InferInsertModel<typeof invitations>> &
    Pick<InferInsertModel<typeof invitations>, "organizationId" | "inviterId">
) {
  const [invitation] = await database
    .insert(invitations)
    .values({
      email: faker.internet.email().toLowerCase(),
      role: "accountant",
      status: "pending",
      expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
      ...overrides
    })
    .returning()

  if (!invitation) throw new Error("makeInvitation: insert failed")

  return invitation
}
