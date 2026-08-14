import { and, asc, eq, isNull } from "drizzle-orm"

import { beforeEach, describe, expect, test, vi } from "vitest"

import { auditLogs, lineItems, proposals, settings, taxRates } from "@/database/schema"

import { makeProject, makeProposal, makeSettings, makeUser } from "@/tests/factories"
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

const ownerId = "00000000-0000-4000-8000-000000000b01"
const ownerEmail = "owner-proposals@example.com"

function makeLineItemInput(overrides?: Record<string, unknown>) {
  return {
    description: "Discovery workshop",
    unit: "day",
    quantity: "2",
    unitPrice: "500.00",
    discountKind: "none",
    discountPercentage: "",
    discountAmount: "",
    taxRateId: "",
    ...overrides
  }
}

function makeProposalInput(overrides?: Record<string, unknown>) {
  return {
    currency: "EUR",
    templateId: "",
    validUntil: "",
    notes: "",
    discountKind: "none",
    discountPercentage: "",
    discountAmount: "",
    lineItems: [makeLineItemInput()],
    ...overrides
  }
}

async function listProposalLines(proposalId: string) {
  return database
    .select()
    .from(lineItems)
    .where(and(eq(lineItems.proposalId, proposalId), isNull(lineItems.deletedAt)))
    .orderBy(asc(lineItems.position))
}

describe("proposal mutations", () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    await makeUser({ id: ownerId, email: ownerEmail })
    await makeSettings({ proposalPrefix: "PROP-", nextProposalNumber: 1, numberPaddingWidth: 4 })

    mocks.headers.mockResolvedValue(
      new Headers({
        "user-agent": "Vitest",
        "x-forwarded-for": "203.0.113.50, 198.51.100.2"
      })
    )
    mocks.getSession.mockResolvedValue({ user: { id: ownerId, email: ownerEmail } })
    mocks.getCurrentRole.mockResolvedValue("owner")
  })

  test("numbers a new proposal from the invoicing settings and advances the counter", async () => {
    const { createProposal } = await import("../mutations")

    const project = await makeProject()

    const result = await createProposal({ projectId: project.id, ...makeProposalInput() })

    expect(result).toEqual({ data: { proposal: expect.objectContaining({ number: "PROP-0001" }) } })

    const settingsRow = await database.select().from(settings)

    expect(settingsRow[0]?.nextProposalNumber).toBe(2)
  })

  test("stores totals in integer cents from the pure service", async () => {
    const { createProposal } = await import("../mutations")

    const project = await makeProject()

    const result = await createProposal({ projectId: project.id, ...makeProposalInput() })

    expect("data" in result).toBe(true)

    const [stored] = await database.select().from(proposals)

    expect(stored?.subtotalCents).toBe(100000)
    expect(stored?.totalCents).toBe(100000)
  })

  test("snapshots the tax percentage onto the line item", async () => {
    const { createProposal } = await import("../mutations")

    const project = await makeProject()
    const [taxRate] = await database
      .insert(taxRates)
      .values({ name: "VAT 23", percentage: "23.00" })
      .returning()

    const result = await createProposal({
      projectId: project.id,
      ...makeProposalInput({ lineItems: [makeLineItemInput({ taxRateId: taxRate?.id })] })
    })

    expect("data" in result).toBe(true)

    const [stored] = await database.select().from(proposals)
    const lines = await listProposalLines(stored?.id ?? "")

    expect(lines[0]?.taxPercentageSnapshot).toBe("23.00")
    expect(stored?.taxAmountCents).toBe(23000)
    expect(stored?.totalCents).toBe(123000)
  })

  test("stores mixed-rate totals that match the pure service to the cent", async () => {
    const { createProposal } = await import("../mutations")
    const { calculateProposalLineTotals, calculateProposalTotal } = await import("../services")

    const project = await makeProject()
    const [standardRate] = await database
      .insert(taxRates)
      .values({ name: "VAT 23", percentage: "23.00" })
      .returning()
    const [reducedRate] = await database
      .insert(taxRates)
      .values({ name: "VAT 6", percentage: "6.00" })
      .returning()

    const serviceLines = [
      {
        quantity: 3,
        unitPriceCents: 33333,
        discount: { type: "percentage" as const, percentage: 10 },
        taxPercentage: 23
      },
      { quantity: 1.5, unitPriceCents: 20000, discount: null, taxPercentage: 6 }
    ]
    const documentDiscount = { type: "fixed" as const, amountCents: 5000 }

    const expectedTotals = calculateProposalTotal(serviceLines, documentDiscount)
    const expectedLines = calculateProposalLineTotals(serviceLines, documentDiscount)

    await createProposal({
      projectId: project.id,
      ...makeProposalInput({
        discountKind: "fixed",
        discountAmount: "50.00",
        lineItems: [
          makeLineItemInput({
            quantity: "3",
            unitPrice: "333.33",
            discountKind: "percentage",
            discountPercentage: "10",
            taxRateId: standardRate?.id
          }),
          makeLineItemInput({
            quantity: "1.5",
            unitPrice: "200.00",
            taxRateId: reducedRate?.id
          })
        ]
      })
    })

    const [stored] = await database.select().from(proposals)
    const lines = await listProposalLines(stored?.id ?? "")

    expect({
      subtotalCents: stored?.subtotalCents,
      discountAmountTotalCents: stored?.discountAmountTotalCents,
      taxAmountCents: stored?.taxAmountCents,
      totalCents: stored?.totalCents
    }).toEqual(expectedTotals)
    expect(lines.map((line) => Number(line.totalCents))).toEqual(
      expectedLines.map((line) => line.totalCents)
    )
    expect(lines.reduce((total, line) => total + Number(line.totalCents), 0)).toBe(
      expectedTotals.totalCents
    )
  })

  test("keeps the snapshot when the underlying tax rate is later edited", async () => {
    const { createProposal } = await import("../mutations")

    const project = await makeProject()
    const [taxRate] = await database
      .insert(taxRates)
      .values({ name: "VAT", percentage: "23.00" })
      .returning()

    await createProposal({
      projectId: project.id,
      ...makeProposalInput({ lineItems: [makeLineItemInput({ taxRateId: taxRate?.id })] })
    })

    await database
      .update(taxRates)
      .set({ percentage: "6.00" })
      .where(eq(taxRates.id, taxRate?.id ?? ""))

    const [stored] = await database.select().from(proposals)
    const lines = await listProposalLines(stored?.id ?? "")

    expect(lines[0]?.taxPercentageSnapshot).toBe("23.00")
    expect(stored?.taxAmountCents).toBe(23000)
  })

  test("mints a cryptographic public token that is not exposed before sending", async () => {
    const { createProposal } = await import("../mutations")
    const { getProposalDetail } = await import("../queries")

    const project = await makeProject()

    await createProposal({ projectId: project.id, ...makeProposalInput() })

    const [stored] = await database.select().from(proposals)

    expect(stored?.publicToken).toMatch(/^[A-Za-z0-9_-]{43}$/)

    const detail = await getProposalDetail({ id: stored?.id })

    expect(detail?.publicPath).toBeNull()
  })

  test("rejects a line item that references an unknown tax rate", async () => {
    const { createProposal } = await import("../mutations")

    const project = await makeProject()

    const result = await createProposal({
      projectId: project.id,
      ...makeProposalInput({
        lineItems: [makeLineItemInput({ taxRateId: "00000000-0000-4000-8000-0000000000ff" })]
      })
    })

    expect("error" in result).toBe(true)
  })

  test("replaces the line items of a draft on update", async () => {
    const { createProposal, updateProposal } = await import("../mutations")

    const project = await makeProject()

    await createProposal({ projectId: project.id, ...makeProposalInput() })

    const [stored] = await database.select().from(proposals)

    const result = await updateProposal({
      id: stored?.id,
      ...makeProposalInput({
        lineItems: [
          makeLineItemInput({ description: "Build", quantity: "1", unitPrice: "250.00" }),
          makeLineItemInput({ description: "Support", quantity: "1", unitPrice: "100.00" })
        ]
      })
    })

    expect("data" in result).toBe(true)

    const lines = await listProposalLines(stored?.id ?? "")

    expect(lines).toHaveLength(2)
    expect(lines.map((line) => line.position)).toEqual([0, 1])
  })

  test("refuses to update a proposal that is no longer a draft", async () => {
    const { updateProposal } = await import("../mutations")

    const project = await makeProject()
    const proposal = await makeProposal({ projectId: project.id, status: "sent" })

    const result = await updateProposal({ id: proposal.id, ...makeProposalInput() })

    expect(result).toEqual({ error: expect.any(String) })

    const lines = await listProposalLines(proposal.id)

    expect(lines).toHaveLength(0)
  })

  test("sends a draft, issues it, and enqueues the PDF render job", async () => {
    const { createProposal, sendProposal } = await import("../mutations")

    const project = await makeProject()

    await createProposal({ projectId: project.id, ...makeProposalInput() })

    const [draft] = await database.select().from(proposals)

    const result = await sendProposal({ id: draft?.id })

    expect(result).toEqual({ data: { id: draft?.id } })

    const [sent] = await database.select().from(proposals)

    expect(sent?.status).toBe("sent")
    expect(sent?.issuedAt).toBeInstanceOf(Date)
    expect(sent?.lockedAt).toBeNull()
    // `email: true` is the chain: the client's copy is enqueued by the render job once the PDF
    // exists, never alongside it (see the ordering note in `lib/jobs/types.ts`).
    expect(mocks.enqueueJob).toHaveBeenCalledWith("proposal.pdf.render", {
      proposalId: draft?.id,
      email: true
    })
  })

  test("exposes the client path only once the proposal has been sent", async () => {
    const { createProposal, sendProposal } = await import("../mutations")
    const { getProposalDetail } = await import("../queries")

    const project = await makeProject()

    await createProposal({ projectId: project.id, ...makeProposalInput() })

    const [draft] = await database.select().from(proposals)

    await sendProposal({ id: draft?.id })

    const detail = await getProposalDetail({ id: draft?.id })

    expect(detail?.publicPath).toBe(`/p/${draft?.publicToken}`)
  })

  test("never writes the public token into the audit trail", async () => {
    const { createProposal, sendProposal } = await import("../mutations")

    const project = await makeProject()

    await createProposal({ projectId: project.id, ...makeProposalInput() })

    const [draft] = await database.select().from(proposals)

    await sendProposal({ id: draft?.id })

    const entries = await database.select().from(auditLogs)

    expect(JSON.stringify(entries)).not.toContain(draft?.publicToken)
    expect(entries.some((entry) => entry.event === "proposal.sent")).toBe(true)
  })

  test("refuses to send a proposal that has no line items", async () => {
    const { sendProposal } = await import("../mutations")

    const project = await makeProject()
    const proposal = await makeProposal({ projectId: project.id })

    const result = await sendProposal({ id: proposal.id })

    expect(result).toEqual({ error: expect.any(String) })
    expect(mocks.enqueueJob).not.toHaveBeenCalled()
  })

  test("refuses to send a proposal that is already sent", async () => {
    const { sendProposal } = await import("../mutations")

    const project = await makeProject()
    const proposal = await makeProposal({ projectId: project.id, status: "sent" })

    const result = await sendProposal({ id: proposal.id })

    expect(result).toEqual({ error: expect.any(String) })
    expect(mocks.enqueueJob).not.toHaveBeenCalled()
  })

  test("soft deletes a proposal and audits the deletion", async () => {
    const { softDeleteProposal } = await import("../mutations")

    const project = await makeProject()
    const proposal = await makeProposal({ projectId: project.id })

    const result = await softDeleteProposal({ id: proposal.id })

    expect(result).toEqual({ data: { id: proposal.id } })

    const [deleted] = await database.select().from(proposals)

    expect(deleted?.deletedAt).toBeInstanceOf(Date)

    const entries = await database.select().from(auditLogs)

    expect(entries.some((entry) => entry.event === "proposal.deleted")).toBe(true)
  })

  test("refuses every write for a role without proposal permissions", async () => {
    const { createProposal, sendProposal, softDeleteProposal } = await import("../mutations")

    mocks.getCurrentRole.mockResolvedValue("accountant")

    const project = await makeProject()
    const proposal = await makeProposal({ projectId: project.id })

    expect(await createProposal({ projectId: project.id, ...makeProposalInput() })).toEqual({
      error: expect.any(String)
    })
    expect(await sendProposal({ id: proposal.id })).toEqual({ error: expect.any(String) })
    expect(await softDeleteProposal({ id: proposal.id })).toEqual({ error: expect.any(String) })
  })

  test("lets an assistant draft a proposal but not send or delete it", async () => {
    const { createProposal, sendProposal, softDeleteProposal } = await import("../mutations")

    mocks.getCurrentRole.mockResolvedValue("assistant")

    const project = await makeProject()

    const created = await createProposal({ projectId: project.id, ...makeProposalInput() })

    expect("data" in created).toBe(true)

    const [draft] = await database.select().from(proposals)

    expect(await sendProposal({ id: draft?.id })).toEqual({ error: expect.any(String) })
    expect(await softDeleteProposal({ id: draft?.id })).toEqual({ error: expect.any(String) })
  })
})
