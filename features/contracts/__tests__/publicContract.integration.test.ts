import { randomBytes } from "node:crypto"

import { beforeEach, describe, expect, test, vi } from "vitest"

import { makeClient, makeContract, makeProject, makeSettings } from "@/tests/factories"
import { makeTextBlock } from "@/tests/factories/blocks"

import { getContractSigningTarget, getPublicContract } from "../publicQueries"

const mocks = vi.hoisted(() => ({
  matchesPublicContractToken: vi.fn()
}))

vi.mock("../services/publicContractToken", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/publicContractToken")>()

  return {
    matchesPublicContractToken: mocks.matchesPublicContractToken.mockImplementation(
      actual.matchesPublicContractToken
    )
  }
})

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

beforeEach(async () => {
  vi.clearAllMocks()

  await makeSettings({ businessName: "Studio Remit", defaultLocale: "en", defaultTimezone: "UTC" })
})

describe("getPublicContract", () => {
  test("renders a sent contract for the holder of its token", async () => {
    const { contract } = await makeSentContract()

    const result = await getPublicContract({ token: contract.publicToken })

    expect(result).toEqual(
      expect.objectContaining({
        number: contract.number,
        title: contract.title,
        status: "sent",
        clientName: "Northwind Ltd"
      })
    )
  })

  test("renders the contract content as a sized document", async () => {
    const { contract } = await makeSentContract()

    const result = await getPublicContract({ token: contract.publicToken })

    expect(result?.document?.html).toContain("<div")
    expect(result?.document?.width).toBeGreaterThan(0)
    expect(result?.document?.height).toBeGreaterThan(0)
  })

  test("renders no document when every block is hidden", async () => {
    const { contract } = await makeSentContract({ blocks: [{ ...makeTextBlock(), hidden: true }] })

    const result = await getPublicContract({ token: contract.publicToken })

    expect(result?.document).toBeNull()
  })

  test("never exposes the token or the contract id in the read model", async () => {
    const { contract } = await makeSentContract()

    const result = await getPublicContract({ token: contract.publicToken })

    expect(JSON.stringify(result)).not.toContain(contract.publicToken)
    expect(JSON.stringify(result)).not.toContain(contract.id)
  })

  test("resolves the client through the project when the contract has no direct client", async () => {
    const client = await makeClient({ name: "Contoso", email: "ap@contoso.test" })
    const project = await makeProject({ clientId: client.id })

    const contract = await makeContract({
      projectId: project.id,
      status: "sent",
      publicToken: makeToken(),
      issuedAt: new Date("2026-07-15T09:30:00.000Z")
    })

    const result = await getPublicContract({ token: contract.publicToken })

    expect(result?.clientName).toBe("Contoso")
  })

  test("returns null for a token that matches no contract", async () => {
    await makeSentContract()

    const result = await getPublicContract({ token: makeToken() })

    expect(result).toBeNull()
  })

  test("returns null for a malformed token", async () => {
    await makeSentContract()

    const result = await getPublicContract({ token: "" })

    expect(result).toBeNull()
  })

  test("returns null for a soft-deleted contract", async () => {
    const { contract } = await makeSentContract({ deletedAt: new Date() })

    const result = await getPublicContract({ token: contract.publicToken })

    expect(result).toBeNull()
  })

  test("returns null for a contract that was never sent", async () => {
    const { contract } = await makeSentContract({ status: "draft", issuedAt: null })

    const result = await getPublicContract({ token: contract.publicToken })

    expect(result).toBeNull()
  })

  test("returns null for a contract that is already signed", async () => {
    const { contract } = await makeSentContract({ status: "signed" })

    const result = await getPublicContract({ token: contract.publicToken })

    expect(result).toBeNull()
  })

  test("returns null for a terminated contract", async () => {
    const { contract } = await makeSentContract({
      status: "terminated",
      terminatedAt: new Date(),
      terminationReason: "Scope withdrawn"
    })

    const result = await getPublicContract({ token: contract.publicToken })

    expect(result).toBeNull()
  })

  test("returns null for a sent contract whose effective window has closed", async () => {
    const { contract } = await makeSentContract({
      effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
      effectiveUntil: new Date("2026-01-31T00:00:00.000Z")
    })

    const result = await getPublicContract({ token: contract.publicToken })

    expect(result).toBeNull()
  })

  test("compares against a decoy when the lookup misses, so a miss costs a miss the same work", async () => {
    await makeSentContract()

    await getPublicContract({ token: makeToken() })

    expect(mocks.matchesPublicContractToken).toHaveBeenCalledTimes(1)
    expect(mocks.matchesPublicContractToken.mock.calls[0]?.[1]).toHaveLength(43)
  })
})

describe("getContractSigningTarget", () => {
  test("resolves the contract ids the public read model withholds", async () => {
    const { client, contract } = await makeSentContract()

    const result = await getContractSigningTarget({ token: contract.publicToken })

    expect(result).toEqual(
      expect.objectContaining({ id: contract.id, clientId: client.id, status: "sent" })
    )
  })

  test("derives the same consent text the page displays", async () => {
    const { contract } = await makeSentContract()

    const [page, target] = await Promise.all([
      getPublicContract({ token: contract.publicToken }),
      getContractSigningTarget({ token: contract.publicToken })
    ])

    expect(target?.consentText).toBe(page?.consentText)
    expect(target?.consentText).toContain(contract.number)
    expect(target?.consentText).toContain("Studio Remit")
  })

  test("returns null for a contract that can no longer be signed", async () => {
    const { contract } = await makeSentContract({ status: "signed" })

    const result = await getContractSigningTarget({ token: contract.publicToken })

    expect(result).toBeNull()
  })
})
