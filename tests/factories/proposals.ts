import { faker } from "@faker-js/faker"

import { type InferInsertModel } from "drizzle-orm"

import { proposals } from "@/database/schema"

import { database } from "@/tests/integration/database"

import { resolveProjectClientId } from "./projectParent"
import { makeProject } from "./projects"

// A project parent by default, which is where every proposal hung before stage 29. A client-level
// proposal is built by passing `clientId` with `projectId: null`; `chk_proposals_parent` needs one
// of the two, and `chk_proposals_project_requires_client` needs the client whenever a project is
// named, which is what `resolveProjectClientId` supplies.
export async function makeProposal(overrides?: Partial<InferInsertModel<typeof proposals>>) {
  const hasParentOverride = overrides?.projectId !== undefined || overrides?.clientId !== undefined
  const projectId = hasParentOverride ? (overrides?.projectId ?? null) : (await makeProject()).id
  const clientId = await resolveProjectClientId(projectId, overrides?.clientId)

  const [proposal] = await database
    .insert(proposals)
    .values({
      number: `PROP-${faker.string.alphanumeric(8).toUpperCase()}`,
      status: "draft",
      currency: "EUR",
      publicToken: faker.string.alphanumeric(32),
      subtotalCents: 0,
      discountAmountTotalCents: 0,
      taxAmountCents: 0,
      totalCents: 0,
      viewCount: 0,
      ...overrides,
      projectId,
      clientId
    })
    .returning()

  if (!proposal) throw new Error("makeProposal: insert failed")

  return proposal
}
