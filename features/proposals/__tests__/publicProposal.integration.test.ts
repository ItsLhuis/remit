import { randomBytes } from "node:crypto"

import { eq } from "drizzle-orm"

import { beforeEach, describe, expect, test } from "vitest"

import { clients, projects, proposals } from "@/database/schema"

import {
  makeClient,
  makeLineItem,
  makeProject,
  makeProposal,
  makeSettings
} from "@/tests/factories"
import { database } from "@/tests/integration/database"

import { getPublicProposal } from "../publicQueries"

function makeToken() {
  return randomBytes(32).toString("base64url")
}

async function makeSentProposal(overrides?: Record<string, unknown>) {
  const client = await makeClient({ email: "client@example.com" })
  const project = await makeProject({ clientId: client.id, name: "Website rebuild" })

  const proposal = await makeProposal({
    projectId: project.id,
    status: "sent",
    publicToken: makeToken(),
    issuedAt: new Date("2026-07-01T10:00:00.000Z"),
    totalCents: 123400,
    subtotalCents: 100000,
    taxAmountCents: 23400,
    ...overrides
  })

  await makeLineItem({ proposalId: proposal.id, description: "Discovery workshop" })

  return { client, project, proposal }
}

beforeEach(async () => {
  await makeSettings({ businessName: "Studio Remit", defaultLocale: "en", defaultTimezone: "UTC" })
})

describe("getPublicProposal", () => {
  test("renders a sent proposal for the holder of its token", async () => {
    const { proposal } = await makeSentProposal()

    const result = await getPublicProposal({ token: proposal.publicToken })

    expect(result).toEqual(
      expect.objectContaining({
        number: proposal.number,
        status: "sent",
        totalCents: 123400,
        preparedForLabel: "Website rebuild",
        canRespond: true
      })
    )
    expect(result?.lineItems).toHaveLength(1)
  })

  test("never exposes the token or the client address in the read model", async () => {
    const { proposal } = await makeSentProposal()

    const result = await getPublicProposal({ token: proposal.publicToken })

    expect(JSON.stringify(result)).not.toContain(proposal.publicToken)
    expect(JSON.stringify(result)).not.toContain("client@example.com")
  })

  test("returns the same empty result for an unknown token as for an archived proposal", async () => {
    const { proposal } = await makeSentProposal()

    await database
      .update(proposals)
      .set({ deletedAt: new Date() })
      .where(eq(proposals.id, proposal.id))

    const archived = await getPublicProposal({ token: proposal.publicToken })
    const unknown = await getPublicProposal({ token: makeToken() })

    expect(archived).toBeNull()
    expect(unknown).toBeNull()
    expect(archived).toEqual(unknown)
  })

  test("returns the same empty result for a malformed token", async () => {
    await expect(getPublicProposal({ token: "" })).resolves.toBeNull()
    await expect(getPublicProposal({ token: "x".repeat(500) })).resolves.toBeNull()
    await expect(getPublicProposal({})).resolves.toBeNull()
  })

  test("withholds a proposal that has never been sent", async () => {
    const { proposal } = await makeSentProposal({ status: "draft", issuedAt: null })

    await expect(getPublicProposal({ token: proposal.publicToken })).resolves.toBeNull()
  })

  test("withholds a pending proposal past its validity date", async () => {
    const { proposal } = await makeSentProposal({
      validUntil: new Date("2020-01-01T00:00:00.000Z")
    })

    await expect(getPublicProposal({ token: proposal.publicToken })).resolves.toBeNull()
  })

  test("still shows an accepted proposal past its validity date", async () => {
    const { proposal } = await makeSentProposal({
      status: "accepted",
      validUntil: new Date("2020-01-01T00:00:00.000Z"),
      respondedAt: new Date("2020-01-01T00:00:00.000Z"),
      respondedIp: "203.0.113.7",
      lockedAt: new Date("2020-01-01T00:00:00.000Z")
    })

    const result = await getPublicProposal({ token: proposal.publicToken })

    expect(result?.status).toBe("accepted")
    expect(result?.canRespond).toBe(false)
  })

  test("withholds a proposal whose project has been archived", async () => {
    const { project, proposal } = await makeSentProposal()

    await database
      .update(projects)
      .set({ deletedAt: new Date() })
      .where(eq(projects.id, project.id))

    await expect(getPublicProposal({ token: proposal.publicToken })).resolves.toBeNull()
  })

  test("withholds a proposal whose client has been archived", async () => {
    const { client, proposal } = await makeSentProposal()

    await database.update(clients).set({ deletedAt: new Date() }).where(eq(clients.id, client.id))

    await expect(getPublicProposal({ token: proposal.publicToken })).resolves.toBeNull()
  })
})
