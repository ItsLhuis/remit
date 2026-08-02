import { and, asc, eq, isNull } from "drizzle-orm"

import { beforeEach, describe, expect, test, vi } from "vitest"

import { auditLogs, invoices, lineItems, proposals, settings, taxRates } from "@/database/schema"

import { makeLineItem, makeProject, makeProposal, makeSettings, makeUser } from "@/tests/factories"
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
const ownerEmail = "owner-invoices@example.com"

function makeLineItemInput(overrides?: Record<string, unknown>) {
  return {
    description: "Implementation sprint",
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

function makeInvoiceInput(overrides?: Record<string, unknown>) {
  return {
    currency: "EUR",
    templateId: "",
    issueDate: "",
    dueDate: "",
    notes: "",
    discountKind: "none",
    discountPercentage: "",
    discountAmount: "",
    lineItems: [makeLineItemInput()],
    ...overrides
  }
}

async function listInvoiceLines(invoiceId: string) {
  return database
    .select()
    .from(lineItems)
    .where(and(eq(lineItems.invoiceId, invoiceId), isNull(lineItems.deletedAt)))
    .orderBy(asc(lineItems.position))
}

// `chk_proposals_response` refuses an accepted proposal without a recorded response, so every
// conversion fixture has to carry one; the shared factory stays generic.
async function makeAcceptedProposal(projectId: string, overrides?: Record<string, unknown>) {
  return makeProposal({
    projectId,
    status: "accepted",
    issuedAt: new Date("2026-07-01T00:00:00.000Z"),
    respondedAt: new Date("2026-07-05T00:00:00.000Z"),
    respondedIp: "203.0.113.10",
    ...overrides
  })
}

async function createSentInvoice(projectId: string) {
  const { createInvoice, sendInvoice } = await import("../mutations")

  const created = await createInvoice({ projectId, ...makeInvoiceInput() })

  if ("error" in created) throw new Error(created.error)

  await sendInvoice({ id: created.data.invoice.id })

  return created.data.invoice.id
}

describe("invoice mutations", () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    await makeUser({ id: ownerId, email: ownerEmail })
    await makeSettings({
      invoicePrefix: "INV-",
      nextInvoiceNumber: 1,
      numberPaddingWidth: 4,
      paymentTermsDays: 30
    })

    mocks.headers.mockResolvedValue(
      new Headers({
        "user-agent": "Vitest",
        "x-forwarded-for": "203.0.113.50, 198.51.100.2"
      })
    )
    mocks.getSession.mockResolvedValue({ user: { id: ownerId, email: ownerEmail } })
    mocks.getCurrentRole.mockResolvedValue("owner")
  })

  test("numbers a new invoice from the invoicing settings and advances the counter", async () => {
    const { createInvoice } = await import("../mutations")

    const project = await makeProject()

    const result = await createInvoice({ projectId: project.id, ...makeInvoiceInput() })

    expect(result).toEqual({ data: { invoice: expect.objectContaining({ number: "INV-0001" }) } })

    const settingsRow = await database.select().from(settings)

    expect(settingsRow[0]?.nextInvoiceNumber).toBe(2)
  })

  test("issues consecutive numbers without ever reusing one", async () => {
    const { createInvoice } = await import("../mutations")

    const project = await makeProject()

    await createInvoice({ projectId: project.id, ...makeInvoiceInput() })
    await createInvoice({ projectId: project.id, ...makeInvoiceInput() })
    await createInvoice({ projectId: project.id, ...makeInvoiceInput() })

    const rows = await database
      .select({ number: invoices.number })
      .from(invoices)
      .orderBy(asc(invoices.number))

    expect(rows.map((row) => row.number)).toEqual(["INV-0001", "INV-0002", "INV-0003"])
  })

  test("gives the number back when the create transaction rolls back", async () => {
    const { createInvoice } = await import("../mutations")

    const project = await makeProject()

    const rejected = await createInvoice({
      projectId: project.id,
      ...makeInvoiceInput({
        lineItems: [makeLineItemInput({ taxRateId: "00000000-0000-4000-8000-0000000000ff" })]
      })
    })

    expect("error" in rejected).toBe(true)

    const accepted = await createInvoice({ projectId: project.id, ...makeInvoiceInput() })

    expect(accepted).toEqual({ data: { invoice: expect.objectContaining({ number: "INV-0001" }) } })
  })

  test("does not burn a number when a send fails", async () => {
    const { createInvoice, sendInvoice } = await import("../mutations")

    const project = await makeProject()
    const created = await createInvoice({ projectId: project.id, ...makeInvoiceInput() })

    if ("error" in created) throw new Error(created.error)

    await database.delete(lineItems).where(eq(lineItems.invoiceId, created.data.invoice.id))

    const sent = await sendInvoice({ id: created.data.invoice.id })

    expect("error" in sent).toBe(true)

    const settingsRow = await database.select().from(settings)
    const [stored] = await database.select().from(invoices)

    expect(settingsRow[0]?.nextInvoiceNumber).toBe(2)
    expect(stored?.number).toBe("INV-0001")
    expect(stored?.status).toBe("draft")
  })

  test("stores totals in integer cents from the pure service", async () => {
    const { createInvoice } = await import("../mutations")

    const project = await makeProject()

    await createInvoice({ projectId: project.id, ...makeInvoiceInput() })

    const [stored] = await database.select().from(invoices)

    expect(stored?.subtotalCents).toBe(100000)
    expect(stored?.totalCents).toBe(100000)
  })

  test("snapshots the tax percentage onto the line item", async () => {
    const { createInvoice } = await import("../mutations")

    const project = await makeProject()
    const [taxRate] = await database
      .insert(taxRates)
      .values({ name: "VAT 23", percentage: "23.00" })
      .returning()

    await createInvoice({
      projectId: project.id,
      ...makeInvoiceInput({ lineItems: [makeLineItemInput({ taxRateId: taxRate?.id })] })
    })

    const [stored] = await database.select().from(invoices)
    const lines = await listInvoiceLines(stored?.id ?? "")

    expect(lines[0]?.taxPercentageSnapshot).toBe("23.00")
    expect(stored?.taxAmountCents).toBe(23000)
    expect(stored?.totalCents).toBe(123000)
  })

  test("carries the project's client onto the invoice so it outlives the project", async () => {
    const { createInvoice } = await import("../mutations")

    const project = await makeProject()

    await createInvoice({ projectId: project.id, ...makeInvoiceInput() })

    const [stored] = await database.select().from(invoices)

    expect(stored?.clientId).toBe(project.clientId)
  })

  test("mints a cryptographic public token that is not exposed before sending", async () => {
    const { createInvoice } = await import("../mutations")
    const { getInvoiceDetail } = await import("../queries")

    const project = await makeProject()
    const created = await createInvoice({ projectId: project.id, ...makeInvoiceInput() })

    if ("error" in created) throw new Error(created.error)

    const [stored] = await database.select().from(invoices)
    const detail = await getInvoiceDetail({ id: created.data.invoice.id })

    expect(stored?.publicToken).toHaveLength(43)
    expect(detail?.publicPath).toBeNull()
  })

  test("rejects an edit once the invoice has been sent", async () => {
    const { updateInvoice } = await import("../mutations")

    const project = await makeProject()
    const invoiceId = await createSentInvoice(project.id)

    const result = await updateInvoice({
      id: invoiceId,
      ...makeInvoiceInput({ lineItems: [makeLineItemInput({ unitPrice: "9999.00" })] })
    })

    expect("error" in result).toBe(true)

    const [stored] = await database.select().from(invoices)

    expect(stored?.totalCents).toBe(100000)
  })

  test("stamps the issue date, derives the due date, and opens the client link on send", async () => {
    const { sendInvoice } = await import("../mutations")
    const { getInvoiceDetail } = await import("../queries")
    const { createInvoice } = await import("../mutations")

    const project = await makeProject()
    const created = await createInvoice({ projectId: project.id, ...makeInvoiceInput() })

    if ("error" in created) throw new Error(created.error)

    const result = await sendInvoice({ id: created.data.invoice.id })

    expect("data" in result).toBe(true)

    const [stored] = await database.select().from(invoices)
    const detail = await getInvoiceDetail({ id: created.data.invoice.id })

    expect(stored?.status).toBe("sent")
    expect(stored?.issueDate).not.toBeNull()
    expect(stored?.dueDate).not.toBeNull()
    expect(detail?.publicPath).toBe(`/i/${stored?.publicToken}`)
  })

  test("enqueues the pdf render job on send rather than rendering inline", async () => {
    const { createInvoice, sendInvoice } = await import("../mutations")

    const project = await makeProject()
    const created = await createInvoice({ projectId: project.id, ...makeInvoiceInput() })

    if ("error" in created) throw new Error(created.error)

    await sendInvoice({ id: created.data.invoice.id })

    expect(mocks.enqueueJob).toHaveBeenCalledWith("invoice.pdf.render", {
      invoiceId: created.data.invoice.id
    })
  })

  test("audits a send without ever recording the bearer token", async () => {
    const { createInvoice, sendInvoice } = await import("../mutations")

    const project = await makeProject()
    const created = await createInvoice({ projectId: project.id, ...makeInvoiceInput() })

    if ("error" in created) throw new Error(created.error)

    await sendInvoice({ id: created.data.invoice.id })

    const [stored] = await database.select().from(invoices)
    const entries = await database
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.event, "invoice.sent"))

    expect(entries[0]?.ipAddress).toBe("203.0.113.50")
    expect(JSON.stringify(entries[0]?.metadata)).not.toContain(stored?.publicToken ?? "")
  })

  test("refuses to send an invoice with no line items", async () => {
    const { createInvoice, sendInvoice } = await import("../mutations")

    const project = await makeProject()
    const created = await createInvoice({ projectId: project.id, ...makeInvoiceInput() })

    if ("error" in created) throw new Error(created.error)

    await database.delete(lineItems).where(eq(lineItems.invoiceId, created.data.invoice.id))

    expect("error" in (await sendInvoice({ id: created.data.invoice.id }))).toBe(true)
  })

  test("settles the invoice in full when it is marked paid", async () => {
    const { markInvoicePaid } = await import("../mutations")

    const project = await makeProject()
    const invoiceId = await createSentInvoice(project.id)

    const result = await markInvoicePaid({ id: invoiceId })

    expect("data" in result).toBe(true)

    const [stored] = await database.select().from(invoices)

    expect(stored?.status).toBe("paid")
    expect(stored?.paidAt).not.toBeNull()
    expect(stored?.amountPaidCents).toBe(100000)
  })

  test("refuses to mark a draft invoice as paid", async () => {
    const { createInvoice, markInvoicePaid } = await import("../mutations")

    const project = await makeProject()
    const created = await createInvoice({ projectId: project.id, ...makeInvoiceInput() })

    if ("error" in created) throw new Error(created.error)

    expect("error" in (await markInvoicePaid({ id: created.data.invoice.id }))).toBe(true)
  })

  test("never writes a computed status into the status column", async () => {
    const { markInvoicePaid } = await import("../mutations")

    const project = await makeProject()
    const invoiceId = await createSentInvoice(project.id)

    await database
      .update(invoices)
      .set({
        issueDate: new Date("2020-01-01T00:00:00.000Z"),
        dueDate: new Date("2020-01-31T00:00:00.000Z")
      })
      .where(eq(invoices.id, invoiceId))
    await markInvoicePaid({ id: invoiceId })

    const rows = await database.select({ status: invoices.status }).from(invoices)

    expect(rows.every((row) => ["draft", "sent", "paid"].includes(row.status))).toBe(true)
  })

  test("soft deletes an invoice and audits the deletion", async () => {
    const { createInvoice, softDeleteInvoice } = await import("../mutations")

    const project = await makeProject()
    const created = await createInvoice({ projectId: project.id, ...makeInvoiceInput() })

    if ("error" in created) throw new Error(created.error)

    await softDeleteInvoice({ id: created.data.invoice.id })

    const [stored] = await database.select().from(invoices)
    const entries = await database
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.event, "invoice.deleted"))

    expect(stored?.deletedAt).not.toBeNull()
    expect(entries).toHaveLength(1)
  })

  test("refuses every write to an assistant that is send-only privileged", async () => {
    const { sendInvoice, softDeleteInvoice } = await import("../mutations")

    const project = await makeProject()
    const invoiceId = await createSentInvoice(project.id)

    mocks.getCurrentRole.mockResolvedValue("assistant")

    expect("error" in (await sendInvoice({ id: invoiceId }))).toBe(true)
    expect("error" in (await softDeleteInvoice({ id: invoiceId }))).toBe(true)
  })
})

describe("invoice conversion from an accepted proposal", () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    await makeUser({ id: ownerId, email: ownerEmail })
    await makeSettings({
      invoicePrefix: "INV-",
      nextInvoiceNumber: 1,
      numberPaddingWidth: 4,
      paymentTermsDays: 30
    })

    mocks.headers.mockResolvedValue(new Headers({ "user-agent": "Vitest" }))
    mocks.getSession.mockResolvedValue({ user: { id: ownerId, email: ownerEmail } })
    mocks.getCurrentRole.mockResolvedValue("owner")
  })

  test("copies the accepted proposal's line items and tax snapshots onto the invoice", async () => {
    const { createInvoiceFromProposal } = await import("../conversion")

    const project = await makeProject()
    const proposal = await makeAcceptedProposal(project.id, {
      currency: "EUR",
      subtotalCents: 100000,
      taxAmountCents: 23000,
      totalCents: 123000
    })

    await makeLineItem({
      proposalId: proposal.id,
      position: 0,
      description: "Discovery workshop",
      unit: "day",
      quantity: "2",
      unitPriceCents: 50000,
      taxPercentageSnapshot: "23.00",
      subtotalCents: 100000,
      taxAmountCents: 23000,
      totalCents: 123000
    })

    const result = await createInvoiceFromProposal({ proposalId: proposal.id })

    expect("data" in result).toBe(true)

    const [stored] = await database.select().from(invoices)
    const lines = await listInvoiceLines(stored?.id ?? "")

    expect(stored?.proposalId).toBe(proposal.id)
    expect(stored?.projectId).toBe(project.id)
    expect(stored?.totalCents).toBe(123000)
    expect(lines[0]?.description).toBe("Discovery workshop")
    expect(lines[0]?.taxPercentageSnapshot).toBe("23.00")
  })

  test("keeps the proposal's snapshot even when the tax rate has since changed", async () => {
    const { createInvoiceFromProposal } = await import("../conversion")

    const project = await makeProject()
    const [taxRate] = await database
      .insert(taxRates)
      .values({ name: "VAT", percentage: "6.00" })
      .returning()
    const proposal = await makeAcceptedProposal(project.id)

    await makeLineItem({
      proposalId: proposal.id,
      taxRateId: taxRate?.id,
      unitPriceCents: 100000,
      taxPercentageSnapshot: "23.00",
      subtotalCents: 100000,
      taxAmountCents: 23000,
      totalCents: 123000
    })

    await createInvoiceFromProposal({ proposalId: proposal.id })

    const [stored] = await database.select().from(invoices)
    const lines = await listInvoiceLines(stored?.id ?? "")

    expect(lines[0]?.taxPercentageSnapshot).toBe("23.00")
    expect(stored?.taxAmountCents).toBe(23000)
  })

  test("refuses to invoice a proposal that has not been accepted", async () => {
    const { createInvoiceFromProposal } = await import("../conversion")

    const project = await makeProject()
    const proposal = await makeProposal({ projectId: project.id, status: "sent" })

    await makeLineItem({ proposalId: proposal.id })

    expect("error" in (await createInvoiceFromProposal({ proposalId: proposal.id }))).toBe(true)
  })

  test("refuses to invoice the same proposal twice", async () => {
    const { createInvoiceFromProposal } = await import("../conversion")

    const project = await makeProject()
    const proposal = await makeAcceptedProposal(project.id)

    await makeLineItem({ proposalId: proposal.id })

    expect("data" in (await createInvoiceFromProposal({ proposalId: proposal.id }))).toBe(true)
    expect("error" in (await createInvoiceFromProposal({ proposalId: proposal.id }))).toBe(true)

    const rows = await database.select({ id: invoices.id }).from(invoices)

    expect(rows).toHaveLength(1)
  })

  test("stops offering a proposal for conversion once it has been invoiced", async () => {
    const { createInvoiceFromProposal } = await import("../conversion")
    const { listConvertibleProposals } = await import("../queries")

    const project = await makeProject()
    const proposal = await makeAcceptedProposal(project.id)

    await makeLineItem({ proposalId: proposal.id })

    expect(await listConvertibleProposals({ projectId: project.id })).toHaveLength(1)

    await createInvoiceFromProposal({ proposalId: proposal.id })

    expect(await listConvertibleProposals({ projectId: project.id })).toHaveLength(0)
  })

  test("leaves the proposal itself untouched", async () => {
    const { createInvoiceFromProposal } = await import("../conversion")

    const project = await makeProject()
    const proposal = await makeAcceptedProposal(project.id)

    await makeLineItem({ proposalId: proposal.id })

    await createInvoiceFromProposal({ proposalId: proposal.id })

    const [stored] = await database.select().from(proposals).where(eq(proposals.id, proposal.id))

    expect(stored?.status).toBe("accepted")
  })
})
