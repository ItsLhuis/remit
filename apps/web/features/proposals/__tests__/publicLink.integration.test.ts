import { eq } from "drizzle-orm"

import { beforeEach, describe, expect, test, vi } from "vitest"

import { auditLogs, proposals } from "@/database/schema"

import {
  makeClient,
  makeLineItem,
  makeProject,
  makeProposal,
  makeSettings,
  makeUser,
  publicTokenOf
} from "@/tests/factories"
import { database } from "@/tests/integration/database"

const mocks = vi.hoisted(() => ({
  emit: vi.fn(),
  enqueueJob: vi.fn(),
  getCurrentRole: vi.fn(),
  getSession: vi.fn(),
  headers: vi.fn(),
  loggerError: vi.fn(),
  matchesPublicToken: vi.fn(),
  revalidatePath: vi.fn()
}))

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath
}))

vi.mock("next/headers", () => ({
  headers: mocks.headers
}))

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mocks.getSession } }
}))

vi.mock("@/lib/auth/session", () => ({
  getCurrentRole: mocks.getCurrentRole
}))

vi.mock("@/lib/events", () => ({
  emit: mocks.emit
}))

vi.mock("@/lib/jobs", () => ({
  enqueueJob: mocks.enqueueJob
}))

vi.mock("@/lib/logger", () => ({
  logger: { error: mocks.loggerError, fatal: vi.fn(), info: vi.fn(), warn: vi.fn() }
}))

vi.mock("@/lib/publicToken", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/publicToken")>()

  return {
    ...actual,
    matchesPublicToken: mocks.matchesPublicToken.mockImplementation(actual.matchesPublicToken)
  }
})

const ownerId = "00000000-0000-4000-8000-0000000004b1"

async function makeSentProposal(overrides?: Record<string, unknown>) {
  const client = await makeClient({ name: "Northwind Ltd", email: "ops@northwind.test" })
  const project = await makeProject({ clientId: client.id })

  const proposal = await makeProposal({
    projectId: project.id,
    clientId: client.id,
    status: "sent",
    issuedAt: new Date("2026-07-01T00:00:00.000Z"),
    totalCents: 123400,
    ...overrides
  })

  await makeLineItem({
    proposalId: proposal.id,
    invoiceId: null,
    description: "Discovery workshop"
  })

  return proposal
}

async function readToken(proposalId: string) {
  const row = await database.query.proposals.findFirst({ where: eq(proposals.id, proposalId) })

  return row?.publicToken ?? null
}

describe("proposal public link lifecycle", () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    await makeUser({ id: ownerId, email: "owner-proposal-link@example.com" })
    await makeSettings({
      businessName: "Studio Remit",
      defaultLocale: "en",
      defaultTimezone: "UTC"
    })

    mocks.headers.mockResolvedValue(
      new Headers({ "user-agent": "Vitest", "x-forwarded-for": "203.0.113.50" })
    )
    mocks.getSession.mockResolvedValue({ user: { id: ownerId } })
    mocks.getCurrentRole.mockResolvedValue("owner")
  })

  test("stops resolving the old link and resolves the new one after a rotation", async () => {
    const { rotateProposalPublicLink } = await import("../publicLink")
    const { getPublicProposal } = await import("../publicQueries")

    const proposal = await makeSentProposal()
    const originalToken = publicTokenOf(proposal)

    await rotateProposalPublicLink({ id: proposal.id })

    const rotatedToken = await readToken(proposal.id)

    expect(rotatedToken).not.toBe(originalToken)
    expect(await getPublicProposal({ token: originalToken })).toBeNull()
    expect(await getPublicProposal({ token: rotatedToken })).not.toBeNull()
  })

  test("answers a revoked, a rotated-away and an unknown token identically", async () => {
    const { revokeProposalPublicLink, rotateProposalPublicLink } = await import("../publicLink")
    const { getPublicProposal } = await import("../publicQueries")

    const rotated = await makeSentProposal()
    const rotatedAwayToken = publicTokenOf(rotated)

    await rotateProposalPublicLink({ id: rotated.id })

    const revoked = await makeSentProposal()
    const revokedToken = publicTokenOf(revoked)

    await revokeProposalPublicLink({ id: revoked.id })

    const unknownToken = "0".repeat(43).replace("0", "1")

    mocks.matchesPublicToken.mockClear()

    const results = await Promise.all([
      getPublicProposal({ token: rotatedAwayToken }),
      getPublicProposal({ token: revokedToken }),
      getPublicProposal({ token: unknownToken })
    ])

    expect(results).toEqual([null, null, null])
    // Each miss still spends one constant-time compare against a full-length decoy, so no branch
    // above tells a revoked document apart from a token that never existed.
    expect(mocks.matchesPublicToken).toHaveBeenCalledTimes(3)

    for (const call of mocks.matchesPublicToken.mock.calls) expect(call[1]).toHaveLength(43)
  })

  test("keeps a revoked proposal unreachable and its token cleared", async () => {
    const { revokeProposalPublicLink } = await import("../publicLink")

    const proposal = await makeSentProposal()

    await revokeProposalPublicLink({ id: proposal.id })

    expect(await readToken(proposal.id)).toBeNull()
  })

  test("refuses to manage the link of a proposal that was never sent", async () => {
    const { revokeProposalPublicLink, rotateProposalPublicLink } = await import("../publicLink")

    const proposal = await makeProposal({ status: "draft", issuedAt: null })
    const draftToken = publicTokenOf(proposal)

    const rotateResult = await rotateProposalPublicLink({ id: proposal.id })
    const revokeResult = await revokeProposalPublicLink({ id: proposal.id })

    expect("error" in rotateResult).toBe(true)
    expect("error" in revokeResult).toBe(true)
    expect(await readToken(proposal.id)).toBe(draftToken)
  })

  test("refuses a role below owner and leaves the token in place", async () => {
    const { rotateProposalPublicLink } = await import("../publicLink")

    mocks.getCurrentRole.mockResolvedValue("assistant")

    const proposal = await makeSentProposal()

    const result = await rotateProposalPublicLink({ id: proposal.id })

    expect("error" in result).toBe(true)
    expect(await readToken(proposal.id)).toBe(publicTokenOf(proposal))
  })

  test("audits both actions without recording any token material", async () => {
    const { revokeProposalPublicLink, rotateProposalPublicLink } = await import("../publicLink")

    const proposal = await makeSentProposal()
    const originalToken = publicTokenOf(proposal)

    await rotateProposalPublicLink({ id: proposal.id })

    const rotatedToken = await readToken(proposal.id)

    await revokeProposalPublicLink({ id: proposal.id })

    const rows = await database
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.targetEntityId, proposal.id))

    const events = rows.map((row) => row.event)

    expect(events).toContain("proposal.public_link.rotated")
    expect(events).toContain("proposal.public_link.revoked")

    const serialized = JSON.stringify(rows)

    expect(serialized).not.toContain(originalToken)
    expect(serialized).not.toContain(rotatedToken)
  })
})
