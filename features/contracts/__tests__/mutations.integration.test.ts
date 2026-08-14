import { desc, eq } from "drizzle-orm"

import { beforeEach, describe, expect, test, vi } from "vitest"

import { auditLogs, contracts, settings } from "@/database/schema"

import { makeClient, makeContract, makeProject, makeSettings, makeUser } from "@/tests/factories"
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

const ownerId = "00000000-0000-4000-8000-000000000c01"
const ownerEmail = "owner-contracts@example.com"

function makeContractInput(overrides?: Record<string, unknown>) {
  return {
    title: "Retainer agreement",
    projectId: null,
    clientId: null,
    templateId: null,
    blocks: [makeTextBlock()],
    effectiveFrom: null,
    effectiveUntil: null,
    ...overrides
  }
}

describe("contract mutations", () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    await makeUser({ id: ownerId, email: ownerEmail })
    await makeSettings({ contractPrefix: "CTR-", nextContractNumber: 1, numberPaddingWidth: 4 })

    mocks.headers.mockResolvedValue(
      new Headers({
        "user-agent": "Vitest",
        "x-forwarded-for": "203.0.113.50, 198.51.100.2"
      })
    )
    mocks.getSession.mockResolvedValue({ user: { id: ownerId, email: ownerEmail } })
    mocks.getCurrentRole.mockResolvedValue("owner")
  })

  test("creates a client-level contract with a padded sequential number when no project is given", async () => {
    const { createContract } = await import("../mutations")

    const client = await makeClient()

    const result = await createContract(makeContractInput({ clientId: client.id }))

    expect(result).toEqual({
      data: { contract: expect.objectContaining({ number: "CTR-0001", clientId: client.id }) }
    })

    const settingsRow = await database.select().from(settings)

    expect(settingsRow[0]?.nextContractNumber).toBe(2)
  })

  test("creates a project-level contract when only a project is given", async () => {
    const { createContract } = await import("../mutations")

    const project = await makeProject()

    const result = await createContract(makeContractInput({ projectId: project.id }))

    expect(result).toEqual({
      data: {
        contract: expect.objectContaining({ projectId: project.id, clientId: null })
      }
    })
  })

  test("rejects a contract with neither a project nor a client", async () => {
    const { createContract } = await import("../mutations")

    const result = await createContract(makeContractInput())

    expect("error" in result).toBe(true)

    const rows = await database.select().from(contracts)

    expect(rows).toHaveLength(0)
  })

  test("rejects an effective range that ends before it starts", async () => {
    const { createContract } = await import("../mutations")

    const client = await makeClient()

    const result = await createContract(
      makeContractInput({
        clientId: client.id,
        effectiveFrom: "2026-08-01",
        effectiveUntil: "2026-07-01"
      })
    )

    expect("error" in result).toBe(true)

    const rows = await database.select().from(contracts)

    expect(rows).toHaveLength(0)
  })

  test("updates a draft contract's blocks and title", async () => {
    const { updateContract } = await import("../mutations")

    const contract = await makeContract()
    const nextBlocks = [makeTextBlock({ content: { html: "<p>Revised scope</p>" } })]

    const result = await updateContract({
      id: contract.id,
      ...makeContractInput({
        title: "Revised agreement",
        clientId: contract.clientId,
        blocks: nextBlocks
      })
    })

    expect(result).toEqual({
      data: { contract: expect.objectContaining({ title: "Revised agreement" }) }
    })

    const [stored] = await database.select().from(contracts).where(eq(contracts.id, contract.id))

    expect(stored?.blocks).toEqual(nextBlocks)
  })

  test("refuses to update a contract that has been sent", async () => {
    const { updateContract } = await import("../mutations")

    const contract = await makeContract({ status: "sent", issuedAt: new Date(), title: "Issued" })

    const result = await updateContract({
      id: contract.id,
      ...makeContractInput({ title: "Sneaky rewrite", clientId: contract.clientId })
    })

    expect(result).toEqual({ error: "Only draft contracts can be changed" })

    const [stored] = await database.select().from(contracts).where(eq(contracts.id, contract.id))

    expect(stored?.title).toBe("Issued")
  })

  test("sends a draft contract, stamps issued_at, and enqueues the pdf render job", async () => {
    const { sendContract } = await import("../mutations")

    const contract = await makeContract()

    const result = await sendContract({ id: contract.id })

    expect(result).toEqual({ data: { id: contract.id } })

    const [stored] = await database.select().from(contracts).where(eq(contracts.id, contract.id))

    expect(stored?.status).toBe("sent")
    expect(stored?.issuedAt).toBeInstanceOf(Date)
    // `email: true` is the chain: the client's copy is enqueued by the render job once the PDF
    // exists, never alongside it (see the ordering note in `lib/jobs/types.ts`).
    expect(mocks.enqueueJob).toHaveBeenCalledWith("contract.pdf.render", {
      contractId: contract.id,
      email: true
    })
  })

  test("refuses to send a contract with an empty block snapshot", async () => {
    const { sendContract } = await import("../mutations")

    const contract = await makeContract({ blocks: [] })

    const result = await sendContract({ id: contract.id })

    expect(result).toEqual({ error: "Add content before sending this contract" })

    const [stored] = await database.select().from(contracts).where(eq(contracts.id, contract.id))

    expect(stored?.status).toBe("draft")
    expect(mocks.enqueueJob).not.toHaveBeenCalled()
  })

  test("does not consume a contract number when a send fails", async () => {
    const { createContract, sendContract } = await import("../mutations")

    const client = await makeClient()

    const first = await createContract(makeContractInput({ clientId: client.id }))
    const unsendable = await makeContract({ blocks: [] })

    const failed = await sendContract({ id: unsendable.id })

    expect("error" in failed).toBe(true)

    const second = await createContract(makeContractInput({ clientId: client.id }))

    expect([first, second]).toEqual([
      { data: { contract: expect.objectContaining({ number: "CTR-0001" }) } },
      { data: { contract: expect.objectContaining({ number: "CTR-0002" }) } }
    ])
  })

  test("refuses to send a contract that is already signed", async () => {
    const { sendContract } = await import("../mutations")

    const contract = await makeContract({ status: "signed", issuedAt: new Date() })

    const result = await sendContract({ id: contract.id })

    expect(result).toEqual({ error: "That status change is not allowed" })
    expect(mocks.enqueueJob).not.toHaveBeenCalled()
  })

  test("terminates a sent contract and persists the reason", async () => {
    const { terminateContract } = await import("../mutations")

    const contract = await makeContract({ status: "sent", issuedAt: new Date() })

    const result = await terminateContract({
      id: contract.id,
      terminationReason: "Client ended the engagement early"
    })

    expect(result).toEqual({ data: { id: contract.id } })

    const [stored] = await database.select().from(contracts).where(eq(contracts.id, contract.id))

    expect(stored?.status).toBe("terminated")
    expect(stored?.terminationReason).toBe("Client ended the engagement early")
    expect(stored?.terminatedAt).toBeInstanceOf(Date)
  })

  test("refuses to terminate a draft contract", async () => {
    const { terminateContract } = await import("../mutations")

    const contract = await makeContract()

    const result = await terminateContract({
      id: contract.id,
      terminationReason: "Never issued"
    })

    expect(result).toEqual({ error: "That status change is not allowed" })

    const [stored] = await database.select().from(contracts).where(eq(contracts.id, contract.id))

    expect(stored?.status).toBe("draft")
  })

  test("soft deletes a contract and hides it from the list read", async () => {
    const { softDeleteContract } = await import("../mutations")
    const { listContracts } = await import("../queries")
    const { parseContractListQuery } = await import("../schemas")

    const contract = await makeContract()

    const result = await softDeleteContract({ id: contract.id })

    expect(result).toEqual({ data: { id: contract.id } })

    const list = await listContracts(parseContractListQuery({}))

    expect(list.rows).toHaveLength(0)
    expect(list.rowCount).toBe(0)
  })

  test("writes an audit entry without the public token for a send", async () => {
    const { sendContract } = await import("../mutations")

    const contract = await makeContract()

    await sendContract({ id: contract.id })

    const [entry] = await database
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.event, "contract.sent"))

    expect(entry).toBeDefined()
    expect(JSON.stringify(entry?.metadata)).not.toContain(contract.publicToken)
  })

  test("assigns distinct numbers to concurrent creates", async () => {
    const { createContract } = await import("../mutations")

    const client = await makeClient()

    await Promise.all([
      createContract(makeContractInput({ clientId: client.id })),
      createContract(makeContractInput({ clientId: client.id }))
    ])

    const rows = await database
      .select({ number: contracts.number })
      .from(contracts)
      .orderBy(desc(contracts.number))

    expect(new Set(rows.map((row) => row.number)).size).toBe(2)
  })
})
