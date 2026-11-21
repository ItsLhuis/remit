import { eq } from "drizzle-orm"

import { beforeEach, describe, expect, test, vi } from "vitest"

import { auditLogs, contracts } from "@/database/schema"

import {
  makeClient,
  makeContract,
  makeProject,
  makeSettings,
  makeUser,
  publicTokenOf
} from "@/tests/factories"
import { makeTextBlock } from "@/tests/factories/blocks"
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

const ownerId = "00000000-0000-4000-8000-0000000004c1"

async function makeSentContract(overrides?: Record<string, unknown>) {
  const client = await makeClient({ name: "Northwind Ltd", email: "ops@northwind.test" })
  const project = await makeProject({ clientId: client.id })

  return makeContract({
    projectId: project.id,
    clientId: client.id,
    status: "sent",
    blocks: [makeTextBlock()],
    issuedAt: new Date("2026-07-01T00:00:00.000Z"),
    ...overrides
  })
}

async function readToken(contractId: string) {
  const row = await database.query.contracts.findFirst({ where: eq(contracts.id, contractId) })

  return row?.publicToken ?? null
}

describe("contract public link lifecycle", () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    await makeUser({ id: ownerId, email: "owner-contract-link@example.com" })
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
    const { rotateContractPublicLink } = await import("../publicLink")
    const { getPublicContract } = await import("../publicQueries")

    const contract = await makeSentContract()
    const originalToken = publicTokenOf(contract)

    await rotateContractPublicLink({ id: contract.id })

    const rotatedToken = await readToken(contract.id)

    expect(rotatedToken).not.toBe(originalToken)
    expect(await getPublicContract({ token: originalToken })).toBeNull()
    expect(await getPublicContract({ token: rotatedToken })).not.toBeNull()
  })

  test("answers a revoked, a rotated-away and an unknown token identically", async () => {
    const { revokeContractPublicLink, rotateContractPublicLink } = await import("../publicLink")
    const { getPublicContract } = await import("../publicQueries")

    const rotated = await makeSentContract()
    const rotatedAwayToken = publicTokenOf(rotated)

    await rotateContractPublicLink({ id: rotated.id })

    const revoked = await makeSentContract()
    const revokedToken = publicTokenOf(revoked)

    await revokeContractPublicLink({ id: revoked.id })

    const unknownToken = "0".repeat(43).replace("0", "1")

    mocks.matchesPublicToken.mockClear()

    const results = await Promise.all([
      getPublicContract({ token: rotatedAwayToken }),
      getPublicContract({ token: revokedToken }),
      getPublicContract({ token: unknownToken })
    ])

    expect(results).toEqual([null, null, null])
    // Each miss still spends one constant-time compare against a full-length decoy, so no branch
    // above tells a revoked document apart from a token that never existed.
    expect(mocks.matchesPublicToken).toHaveBeenCalledTimes(3)

    for (const call of mocks.matchesPublicToken.mock.calls) expect(call[1]).toHaveLength(43)
  })

  test("keeps a revoked contract unreachable and its token cleared", async () => {
    const { revokeContractPublicLink } = await import("../publicLink")

    const contract = await makeSentContract()

    await revokeContractPublicLink({ id: contract.id })

    expect(await readToken(contract.id)).toBeNull()
  })

  test("refuses to manage the link of a contract that was never sent", async () => {
    const { revokeContractPublicLink, rotateContractPublicLink } = await import("../publicLink")

    const contract = await makeContract({
      status: "draft",
      issuedAt: null,
      blocks: [makeTextBlock()]
    })
    const draftToken = publicTokenOf(contract)

    const rotateResult = await rotateContractPublicLink({ id: contract.id })
    const revokeResult = await revokeContractPublicLink({ id: contract.id })

    expect("error" in rotateResult).toBe(true)
    expect("error" in revokeResult).toBe(true)
    expect(await readToken(contract.id)).toBe(draftToken)
  })

  test("refuses a role below owner and leaves the token in place", async () => {
    const { rotateContractPublicLink } = await import("../publicLink")

    mocks.getCurrentRole.mockResolvedValue("assistant")

    const contract = await makeSentContract()

    const result = await rotateContractPublicLink({ id: contract.id })

    expect("error" in result).toBe(true)
    expect(await readToken(contract.id)).toBe(publicTokenOf(contract))
  })

  test("audits both actions without recording any token material", async () => {
    const { revokeContractPublicLink, rotateContractPublicLink } = await import("../publicLink")

    const contract = await makeSentContract()
    const originalToken = publicTokenOf(contract)

    await rotateContractPublicLink({ id: contract.id })

    const rotatedToken = await readToken(contract.id)

    await revokeContractPublicLink({ id: contract.id })

    const rows = await database
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.targetEntityId, contract.id))

    const events = rows.map((row) => row.event)

    expect(events).toContain("contract.public_link.rotated")
    expect(events).toContain("contract.public_link.revoked")

    const serialized = JSON.stringify(rows)

    expect(serialized).not.toContain(originalToken)
    expect(serialized).not.toContain(rotatedToken)
  })
})
