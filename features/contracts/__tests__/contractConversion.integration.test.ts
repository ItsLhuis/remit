import { count, eq } from "drizzle-orm"

import { beforeEach, describe, expect, test, vi } from "vitest"

import { contracts, lineItems, settings } from "@/database/schema"

import { makeProject, makeProposal, makeSettings, makeTemplate, makeUser } from "@/tests/factories"
import { makeTextBlock } from "@/tests/factories/blocks"
import { database } from "@/tests/integration/database"

const mocks = vi.hoisted(() => ({
  emit: vi.fn(),
  enqueueJob: vi.fn(),
  getCurrentRole: vi.fn(),
  getSession: vi.fn(),
  headers: vi.fn(),
  loggerError: vi.fn(),
  revalidatePath: vi.fn()
}))

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath
}))

vi.mock("next/headers", () => ({
  headers: mocks.headers
}))

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: mocks.getSession
    }
  }
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
  logger: {
    error: mocks.loggerError,
    fatal: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  }
}))

const ownerId = "00000000-0000-4000-8000-000000000c02"
const ownerEmail = "owner-conversion@example.com"

// `chk_proposals_response` requires both response columns once a proposal reads as accepted, so an
// accepted fixture always carries them.
async function makeAcceptedProposal(overrides?: { templateId?: string; projectId?: string }) {
  const projectId = overrides?.projectId ?? (await makeProject()).id

  return makeProposal({
    projectId,
    templateId: overrides?.templateId ?? null,
    status: "accepted",
    respondedAt: new Date(),
    respondedIp: "203.0.113.50"
  })
}

async function countLineItems(): Promise<number> {
  const [row] = await database.select({ value: count() }).from(lineItems)

  return row?.value ?? 0
}

describe("contract conversion", () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    await makeUser({ id: ownerId, email: ownerEmail })
    await makeSettings({ contractPrefix: "CTR-", nextContractNumber: 1, numberPaddingWidth: 4 })

    mocks.headers.mockResolvedValue(new Headers({ "user-agent": "Vitest" }))
    mocks.getSession.mockResolvedValue({ user: { id: ownerId, email: ownerEmail } })
    mocks.getCurrentRole.mockResolvedValue("owner")
  })

  test("creates a contract from an accepted proposal and links it back to the proposal", async () => {
    const { createContractFromProposal } = await import("../mutations")

    const proposal = await makeAcceptedProposal()

    const result = await createContractFromProposal({
      proposalId: proposal.id,
      title: "Engagement contract"
    })

    expect("data" in result).toBe(true)

    const [stored] = await database
      .select()
      .from(contracts)
      .where(eq(contracts.proposalId, proposal.id))

    expect(stored?.proposalId).toBe(proposal.id)
    expect(stored?.projectId).toBe(proposal.projectId)
  })

  test("copies the default contract template's blocks into the new contract", async () => {
    const { createContractFromProposal } = await import("../mutations")

    const contractBlocks = [makeTextBlock({ content: { html: "<p>Contract clauses</p>" } })]

    await makeTemplate({ type: "contract", isDefault: true, blocks: contractBlocks })

    const proposalTemplate = await makeTemplate({
      type: "proposal",
      blocks: [makeTextBlock({ content: { html: "<p>Proposal pitch</p>" } })]
    })
    const proposal = await makeAcceptedProposal({ templateId: proposalTemplate.id })

    await createContractFromProposal({ proposalId: proposal.id, title: "From template" })

    const [stored] = await database
      .select()
      .from(contracts)
      .where(eq(contracts.proposalId, proposal.id))

    expect(stored?.blocks).toEqual(contractBlocks)
  })

  test("falls back to the proposal's template blocks when no contract template is configured", async () => {
    const { createContractFromProposal } = await import("../mutations")

    const proposalBlocks = [makeTextBlock({ content: { html: "<p>Proposal pitch</p>" } })]

    const proposalTemplate = await makeTemplate({ type: "proposal", blocks: proposalBlocks })
    const proposal = await makeAcceptedProposal({ templateId: proposalTemplate.id })

    await createContractFromProposal({ proposalId: proposal.id, title: "From proposal" })

    const [stored] = await database
      .select()
      .from(contracts)
      .where(eq(contracts.proposalId, proposal.id))

    expect(stored?.blocks).toEqual(proposalBlocks)
  })

  test("refuses to convert a proposal that is not accepted", async () => {
    const { createContractFromProposal } = await import("../mutations")

    const proposal = await makeProposal({ status: "sent", issuedAt: new Date() })

    const result = await createContractFromProposal({
      proposalId: proposal.id,
      title: "Too early"
    })

    expect(result).toEqual({ error: "That proposal cannot be turned into a contract" })

    const rows = await database.select().from(contracts)

    expect(rows).toHaveLength(0)
  })

  test("refuses to convert a proposal that already has a contract, and consumes no number", async () => {
    const { createContractFromProposal } = await import("../mutations")

    const proposal = await makeAcceptedProposal()

    await createContractFromProposal({ proposalId: proposal.id, title: "First" })

    const [afterFirst] = await database.select().from(settings)

    const result = await createContractFromProposal({ proposalId: proposal.id, title: "Second" })

    expect(result).toEqual({ error: "That proposal already has a contract" })

    const [afterSecond] = await database.select().from(settings)

    expect(afterSecond?.nextContractNumber).toBe(afterFirst?.nextContractNumber)
  })

  test("creates no line_items rows for a contract", async () => {
    const { createContract, createContractFromProposal, sendContract, updateContract } =
      await import("../mutations")

    const before = await countLineItems()

    const proposal = await makeAcceptedProposal()
    const converted = await createContractFromProposal({
      proposalId: proposal.id,
      title: "Converted"
    })

    expect("data" in converted).toBe(true)

    const project = await makeProject()
    const created = await createContract({
      title: "Direct",
      projectId: project.id,
      clientId: null,
      templateId: null,
      blocks: [makeTextBlock()],
      effectiveFrom: null,
      effectiveUntil: null
    })

    expect("data" in created).toBe(true)

    if ("data" in created) {
      await updateContract({
        id: created.data.contract.id,
        title: "Direct revised",
        projectId: project.id,
        clientId: null,
        templateId: null,
        blocks: [makeTextBlock()],
        effectiveFrom: null,
        effectiveUntil: null
      })
      await sendContract({ id: created.data.contract.id })
    }

    expect(await countLineItems()).toBe(before)
  })
})
