import { randomBytes } from "node:crypto"

import { eq } from "drizzle-orm"

import { beforeEach, describe, expect, test, vi } from "vitest"

import { auditLogs, contractSignatures, contracts } from "@/database/schema"

import { makeClient, makeContract, makeProject, makeSettings } from "@/tests/factories"
import { makeTextBlock } from "@/tests/factories/blocks"
import { database } from "@/tests/integration/database"

import { signPublicContract } from "../publicSigning"

const mocks = vi.hoisted(() => ({
  emit: vi.fn(),
  enqueueJob: vi.fn(),
  loggerError: vi.fn(),
  revalidatePath: vi.fn()
}))

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath
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

const signerContext = {
  ipAddress: "203.0.113.7",
  userAgent: "Mozilla/5.0 (signing browser)"
}

const signerValues = {
  signerName: "Ada Lovelace",
  signerEmail: "ada@northwind.test",
  consentAccepted: true
}

function makeToken() {
  return randomBytes(32).toString("base64url")
}

async function makeSentContract(overrides?: Record<string, unknown>) {
  const client = await makeClient({ name: "Northwind Ltd", email: "ops@northwind.test" })

  const contract = await makeContract({
    clientId: client.id,
    status: "sent",
    publicToken: makeToken(),
    issuedAt: new Date("2026-07-15T09:30:00.000Z"),
    blocks: [makeTextBlock()],
    ...overrides
  })

  return { client, contract }
}

function readSignatures(contractId: string) {
  return database
    .select()
    .from(contractSignatures)
    .where(eq(contractSignatures.contractId, contractId))
}

beforeEach(async () => {
  vi.clearAllMocks()

  await makeSettings({ businessName: "Studio Remit", defaultLocale: "en", defaultTimezone: "UTC" })
})

describe("signPublicContract", () => {
  test("moves a sent contract to signed", async () => {
    const { contract } = await makeSentContract()

    const result = await signPublicContract(signerValues, {
      token: contract.publicToken,
      ...signerContext
    })

    expect(result).toEqual({ data: { status: "signed", signedAt: expect.any(Date) } })

    const [row] = await database
      .select({ status: contracts.status })
      .from(contracts)
      .where(eq(contracts.id, contract.id))

    expect(row?.status).toBe("signed")
  })

  test("records the signer, the consent snapshot and the request metadata", async () => {
    const { contract } = await makeSentContract()

    await signPublicContract(signerValues, { token: contract.publicToken, ...signerContext })

    const [signature] = await readSignatures(contract.id)

    expect(signature).toEqual(
      expect.objectContaining({
        signerName: "Ada Lovelace",
        signerEmail: "ada@northwind.test",
        ipAddress: "203.0.113.7",
        userAgent: "Mozilla/5.0 (signing browser)",
        signedPdfUploadId: null
      })
    )
    expect(signature?.consentText).toContain(contract.number)
    expect(signature?.consentText).toContain("Studio Remit")
  })

  test("records the absence of request metadata rather than refusing the signature", async () => {
    const { contract } = await makeSentContract()

    await signPublicContract(signerValues, {
      token: contract.publicToken,
      ipAddress: null,
      userAgent: null
    })

    const [signature] = await readSignatures(contract.id)

    expect(signature?.ipAddress).toBe("unknown")
    expect(signature?.userAgent).toBe("unknown")
  })

  test("emits contract.signed and enqueues the signed pdf render for the new signature", async () => {
    const { contract } = await makeSentContract()

    await signPublicContract(signerValues, { token: contract.publicToken, ...signerContext })

    const [signature] = await readSignatures(contract.id)

    expect(mocks.emit).toHaveBeenCalledWith("contract.signed", {
      contractId: contract.id,
      signatureId: signature?.id
    })
    expect(mocks.enqueueJob).toHaveBeenCalledWith("contract.signed_pdf.render", {
      contractId: contract.id,
      signatureId: signature?.id
    })
  })

  test("revalidates the contract and its client", async () => {
    const { client, contract } = await makeSentContract()

    await signPublicContract(signerValues, { token: contract.publicToken, ...signerContext })

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/contracts")
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/contracts/${contract.id}`)
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/clients/${client.id}`)
  })

  test("revalidates the parent project of a project-level contract", async () => {
    const client = await makeClient()
    const project = await makeProject({ clientId: client.id })

    const contract = await makeContract({
      projectId: project.id,
      status: "sent",
      publicToken: makeToken(),
      issuedAt: new Date("2026-07-15T09:30:00.000Z")
    })

    await signPublicContract(signerValues, { token: contract.publicToken, ...signerContext })

    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/projects/${project.id}`)
  })

  test("writes an audit entry with no actor and the request metadata", async () => {
    const { contract } = await makeSentContract()

    await signPublicContract(signerValues, { token: contract.publicToken, ...signerContext })

    const [entry] = await database
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.targetEntityId, contract.id))

    expect(entry).toEqual(
      expect.objectContaining({
        event: "contract.signed",
        actorUserId: null,
        targetEntityType: "contract",
        ipAddress: "203.0.113.7",
        userAgent: "Mozilla/5.0 (signing browser)"
      })
    )
  })

  test("never records the public token in the audit trail", async () => {
    const { contract } = await makeSentContract()

    await signPublicContract(signerValues, { token: contract.publicToken, ...signerContext })

    const entries = await database.select().from(auditLogs)

    expect(JSON.stringify(entries)).not.toContain(contract.publicToken)
  })

  test("refuses a draft contract", async () => {
    const { contract } = await makeSentContract({ status: "draft", issuedAt: null })

    const result = await signPublicContract(signerValues, {
      token: contract.publicToken,
      ...signerContext
    })

    expect(result).toEqual({ error: expect.any(String) })
    expect(await readSignatures(contract.id)).toHaveLength(0)
  })

  test("refuses a contract that is already signed", async () => {
    const { contract } = await makeSentContract({ status: "signed" })

    const result = await signPublicContract(signerValues, {
      token: contract.publicToken,
      ...signerContext
    })

    expect(result).toEqual({ error: expect.any(String) })
    expect(await readSignatures(contract.id)).toHaveLength(0)
  })

  test("refuses a terminated contract", async () => {
    const { contract } = await makeSentContract({
      status: "terminated",
      terminatedAt: new Date(),
      terminationReason: "Scope withdrawn"
    })

    const result = await signPublicContract(signerValues, {
      token: contract.publicToken,
      ...signerContext
    })

    expect(result).toEqual({ error: expect.any(String) })
    expect(await readSignatures(contract.id)).toHaveLength(0)
  })

  test("refuses a second signature on a contract it already signed", async () => {
    const { contract } = await makeSentContract()

    await signPublicContract(signerValues, { token: contract.publicToken, ...signerContext })

    const result = await signPublicContract(signerValues, {
      token: contract.publicToken,
      ...signerContext
    })

    expect(result).toEqual({ error: expect.any(String) })
    expect(await readSignatures(contract.id)).toHaveLength(1)
  })

  test("refuses a token that matches no contract", async () => {
    await makeSentContract()

    const result = await signPublicContract(signerValues, {
      token: makeToken(),
      ...signerContext
    })

    expect(result).toEqual({ error: expect.any(String) })
    expect(mocks.emit).not.toHaveBeenCalled()
  })

  test("rejects a missing signer name before touching the contract", async () => {
    const { contract } = await makeSentContract()

    const result = await signPublicContract(
      { ...signerValues, signerName: "   " },
      { token: contract.publicToken, ...signerContext }
    )

    expect(result).toEqual({ error: expect.any(String) })
    expect(await readSignatures(contract.id)).toHaveLength(0)
  })

  test("rejects an invalid signer email before touching the contract", async () => {
    const { contract } = await makeSentContract()

    const result = await signPublicContract(
      { ...signerValues, signerEmail: "not-an-email" },
      { token: contract.publicToken, ...signerContext }
    )

    expect(result).toEqual({ error: expect.any(String) })
    expect(await readSignatures(contract.id)).toHaveLength(0)
  })

  test("rejects an unaccepted consent statement before touching the contract", async () => {
    const { contract } = await makeSentContract()

    const result = await signPublicContract(
      { ...signerValues, consentAccepted: false },
      { token: contract.publicToken, ...signerContext }
    )

    expect(result).toEqual({ error: expect.any(String) })
    expect(await readSignatures(contract.id)).toHaveLength(0)

    const [row] = await database
      .select({ status: contracts.status })
      .from(contracts)
      .where(eq(contracts.id, contract.id))

    expect(row?.status).toBe("sent")
  })

  test("rejects a body that is not an object at all", async () => {
    const { contract } = await makeSentContract()

    const result = await signPublicContract(null, {
      token: contract.publicToken,
      ...signerContext
    })

    expect(result).toEqual({ error: expect.any(String) })
  })
})
