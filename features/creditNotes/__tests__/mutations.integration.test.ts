import { and, asc, eq } from "drizzle-orm"

import { beforeEach, describe, expect, test, vi } from "vitest"

import { auditLogs, creditNotes, invoices, lineItems, settings } from "@/database/schema"

import { makeInvoice, makeSettings, makeUser } from "@/tests/factories"
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

const ownerId = "00000000-0000-4000-8000-000000000e01"
const ownerEmail = "owner-credit-notes@example.com"

function makeLineItemInput(overrides?: Record<string, unknown>) {
  return {
    description: "Cancelled sprint",
    unit: "",
    quantity: "1",
    unitPrice: "100.00",
    discountKind: "none",
    discountPercentage: "",
    discountAmount: "",
    taxRateId: "",
    ...overrides
  }
}

function makeCreditNoteInput(overrides?: Record<string, unknown>) {
  return {
    reason: "Work cancelled",
    lineItems: [makeLineItemInput()],
    ...overrides
  }
}

async function readInvoice(invoiceId: string) {
  const row = await database.query.invoices.findFirst({ where: eq(invoices.id, invoiceId) })

  if (!row) throw new Error("readInvoice: invoice missing")

  return row
}

async function readCreditNote(creditNoteId: string) {
  const row = await database.query.creditNotes.findFirst({
    where: eq(creditNotes.id, creditNoteId)
  })

  if (!row) throw new Error("readCreditNote: credit note missing")

  return row
}

async function listCreditNoteLines(creditNoteId: string) {
  return database
    .select()
    .from(lineItems)
    .where(eq(lineItems.creditNoteId, creditNoteId))
    .orderBy(asc(lineItems.position))
}

describe("credit note mutations", () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    await makeUser({ id: ownerId, email: ownerEmail })
    await makeSettings({ creditNotePrefix: "CN-", nextCreditNoteNumber: 1, numberPaddingWidth: 4 })

    mocks.headers.mockResolvedValue(
      new Headers({
        "user-agent": "Vitest",
        "x-forwarded-for": "203.0.113.50, 198.51.100.2"
      })
    )
    mocks.getSession.mockResolvedValue({ user: { id: ownerId, email: ownerEmail } })
    mocks.getCurrentRole.mockResolvedValue("owner")
  })

  test("mints the first number from the configured prefix and padding", async () => {
    const { createCreditNote } = await import("../mutations")

    const invoice = await makeInvoice({ status: "sent", totalCents: 30000, currency: "EUR" })

    const result = await createCreditNote({ invoiceId: invoice.id, ...makeCreditNoteInput() })

    expect("data" in result).toBe(true)

    if ("error" in result) throw new Error(result.error)

    expect((await readCreditNote(result.data.id)).number).toBe("CN-0001")
  })

  test("advances the sequence so two credit notes never share a number", async () => {
    const { createCreditNote } = await import("../mutations")

    const invoice = await makeInvoice({ status: "sent", totalCents: 30000, currency: "EUR" })

    const first = await createCreditNote({ invoiceId: invoice.id, ...makeCreditNoteInput() })
    const second = await createCreditNote({ invoiceId: invoice.id, ...makeCreditNoteInput() })

    if ("error" in first || "error" in second) throw new Error("createCreditNote rejected")

    const numbers = [
      (await readCreditNote(first.data.id)).number,
      (await readCreditNote(second.data.id)).number
    ]

    expect(numbers).toEqual(["CN-0001", "CN-0002"])

    const settingsRow = await database.query.settings.findFirst({
      columns: { nextCreditNoteNumber: true }
    })

    expect(settingsRow?.nextCreditNoteNumber).toBe(3)
  })

  test("draws credit-note numbers from a counter separate from the invoice one", async () => {
    const { createCreditNote } = await import("../mutations")

    await database.update(settings).set({ nextInvoiceNumber: 77 })

    const invoice = await makeInvoice({ status: "sent", totalCents: 30000, currency: "EUR" })

    const result = await createCreditNote({ invoiceId: invoice.id, ...makeCreditNoteInput() })

    if ("error" in result) throw new Error(result.error)

    expect((await readCreditNote(result.data.id)).number).toBe("CN-0001")

    const settingsRow = await database.query.settings.findFirst({
      columns: { nextInvoiceNumber: true }
    })

    expect(settingsRow?.nextInvoiceNumber).toBe(77)
  })

  test("never reuses the number of a deleted credit note", async () => {
    const { createCreditNote, softDeleteCreditNote } = await import("../mutations")

    const invoice = await makeInvoice({ status: "sent", totalCents: 30000, currency: "EUR" })

    const first = await createCreditNote({ invoiceId: invoice.id, ...makeCreditNoteInput() })

    if ("error" in first) throw new Error(first.error)

    await softDeleteCreditNote({ id: first.data.id })

    const second = await createCreditNote({ invoiceId: invoice.id, ...makeCreditNoteInput() })

    if ("error" in second) throw new Error(second.error)

    expect((await readCreditNote(second.data.id)).number).toBe("CN-0002")
  })

  test("persists the totals with tax and copies the invoice currency", async () => {
    const { createCreditNote } = await import("../mutations")

    const invoice = await makeInvoice({ status: "sent", totalCents: 30000, currency: "USD" })

    const result = await createCreditNote({
      invoiceId: invoice.id,
      ...makeCreditNoteInput({
        lineItems: [makeLineItemInput({ quantity: "2", unitPrice: "50.00" })]
      })
    })

    if ("error" in result) throw new Error(result.error)

    const creditNote = await readCreditNote(result.data.id)

    expect(Number(creditNote.subtotalCents)).toBe(10000)
    expect(Number(creditNote.totalCents)).toBe(10000)
    expect(creditNote.currency).toBe("USD")
  })

  test("writes line items under the credit-note parent alone", async () => {
    const { createCreditNote } = await import("../mutations")

    const invoice = await makeInvoice({ status: "sent", totalCents: 30000, currency: "EUR" })

    const result = await createCreditNote({
      invoiceId: invoice.id,
      ...makeCreditNoteInput({
        lineItems: [makeLineItemInput(), makeLineItemInput({ description: "Second line" })]
      })
    })

    if ("error" in result) throw new Error(result.error)

    const lines = await listCreditNoteLines(result.data.id)

    expect(lines).toHaveLength(2)
    expect(lines.map((line) => line.position)).toEqual([0, 1])
    expect(lines.every((line) => line.invoiceId === null && line.proposalId === null)).toBe(true)
  })

  test("rejects a line item carrying a second parent, which chk_line_items_parent forbids", async () => {
    const { createCreditNote } = await import("../mutations")

    const invoice = await makeInvoice({ status: "sent", totalCents: 30000, currency: "EUR" })

    const result = await createCreditNote({ invoiceId: invoice.id, ...makeCreditNoteInput() })

    if ("error" in result) throw new Error(result.error)

    await expect(
      database.insert(lineItems).values({
        creditNoteId: result.data.id,
        invoiceId: invoice.id,
        position: 9,
        description: "Two parents",
        quantity: "1",
        unitPriceCents: 100,
        taxPercentageSnapshot: "0",
        subtotalCents: 100,
        taxAmountCents: 0,
        totalCents: 100
      })
    ).rejects.toThrow()
  })

  test("enqueues the pdf render job on issue rather than rendering inline", async () => {
    const { createCreditNote } = await import("../mutations")

    const invoice = await makeInvoice({ status: "sent", totalCents: 30000, currency: "EUR" })

    const result = await createCreditNote({ invoiceId: invoice.id, ...makeCreditNoteInput() })

    if ("error" in result) throw new Error(result.error)

    expect(mocks.enqueueJob).toHaveBeenCalledWith("credit_note.pdf.render", {
      creditNoteId: result.data.id
    })
  })

  test("leaves the invoice's stored totals untouched", async () => {
    const { createCreditNote } = await import("../mutations")

    const invoice = await makeInvoice({
      status: "sent",
      totalCents: 30000,
      subtotalCents: 30000,
      currency: "EUR"
    })

    await createCreditNote({ invoiceId: invoice.id, ...makeCreditNoteInput() })

    const updated = await readInvoice(invoice.id)

    expect(Number(updated.totalCents)).toBe(30000)
    expect(Number(updated.subtotalCents)).toBe(30000)
    expect(Number(updated.amountPaidCents)).toBe(0)
  })

  test("reduces the effective receivable derived from the invoice and its credit notes", async () => {
    const { createCreditNote } = await import("../mutations")
    const { listInvoiceCreditNotes } = await import("../queries")
    const { computeInvoiceEffectiveReceivable } = await import("../services")

    const invoice = await makeInvoice({ status: "sent", totalCents: 30000, currency: "EUR" })

    await createCreditNote({ invoiceId: invoice.id, ...makeCreditNoteInput() })

    const issued = await listInvoiceCreditNotes({ invoiceId: invoice.id })

    expect(
      computeInvoiceEffectiveReceivable(
        Number((await readInvoice(invoice.id)).totalCents),
        issued.map((creditNote) => creditNote.totalCents)
      )
    ).toBe(20000)
  })

  test("restores the effective receivable when the credit note is soft deleted", async () => {
    const { createCreditNote, softDeleteCreditNote } = await import("../mutations")
    const { listInvoiceCreditNotes } = await import("../queries")
    const { computeInvoiceEffectiveReceivable } = await import("../services")

    const invoice = await makeInvoice({ status: "sent", totalCents: 30000, currency: "EUR" })

    const result = await createCreditNote({ invoiceId: invoice.id, ...makeCreditNoteInput() })

    if ("error" in result) throw new Error(result.error)

    await softDeleteCreditNote({ id: result.data.id })

    const remaining = await listInvoiceCreditNotes({ invoiceId: invoice.id })

    expect(remaining).toHaveLength(0)
    expect(
      computeInvoiceEffectiveReceivable(
        30000,
        remaining.map((creditNote) => creditNote.totalCents)
      )
    ).toBe(30000)
  })

  test("refuses to credit a draft invoice", async () => {
    const { createCreditNote } = await import("../mutations")

    const invoice = await makeInvoice({ status: "draft", totalCents: 30000, currency: "EUR" })

    const rejected = await createCreditNote({ invoiceId: invoice.id, ...makeCreditNoteInput() })

    expect("error" in rejected).toBe(true)

    const written = await database
      .select()
      .from(creditNotes)
      .where(eq(creditNotes.invoiceId, invoice.id))

    expect(written).toHaveLength(0)
  })

  test("refuses a credit note worth nothing", async () => {
    const { createCreditNote } = await import("../mutations")

    const invoice = await makeInvoice({ status: "sent", totalCents: 30000, currency: "EUR" })

    const rejected = await createCreditNote({
      invoiceId: invoice.id,
      ...makeCreditNoteInput({ lineItems: [makeLineItemInput({ unitPrice: "0.00" })] })
    })

    expect("error" in rejected).toBe(true)
  })

  test("refuses a caller whose role may not issue credit notes", async () => {
    const { createCreditNote } = await import("../mutations")

    mocks.getCurrentRole.mockResolvedValue("assistant")

    const invoice = await makeInvoice({ status: "sent", totalCents: 30000, currency: "EUR" })

    const rejected = await createCreditNote({ invoiceId: invoice.id, ...makeCreditNoteInput() })

    expect("error" in rejected).toBe(true)
  })

  test("refuses a delete from a role that may issue but not destroy", async () => {
    const { createCreditNote, softDeleteCreditNote } = await import("../mutations")

    const invoice = await makeInvoice({ status: "sent", totalCents: 30000, currency: "EUR" })

    const result = await createCreditNote({ invoiceId: invoice.id, ...makeCreditNoteInput() })

    if ("error" in result) throw new Error(result.error)

    mocks.getCurrentRole.mockResolvedValue("accountant")

    const rejected = await softDeleteCreditNote({ id: result.data.id })

    expect("error" in rejected).toBe(true)
    expect((await readCreditNote(result.data.id)).deletedAt).toBeNull()
  })

  test("records an audit entry with the request metadata on issue and on delete", async () => {
    const { createCreditNote, softDeleteCreditNote } = await import("../mutations")

    const invoice = await makeInvoice({ status: "sent", totalCents: 30000, currency: "EUR" })

    const result = await createCreditNote({ invoiceId: invoice.id, ...makeCreditNoteInput() })

    if ("error" in result) throw new Error(result.error)

    await softDeleteCreditNote({ id: result.data.id })

    const entries = await database
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.targetEntityType, "credit_note"),
          eq(auditLogs.targetEntityId, result.data.id)
        )
      )
      .orderBy(asc(auditLogs.createdAt))

    expect(entries.map((entry) => entry.event)).toEqual([
      "credit_note.created",
      "credit_note.deleted"
    ])
    expect(entries[0]?.ipAddress).toBe("203.0.113.50")
    expect(entries[0]?.userAgent).toBe("Vitest")
  })

  test("announces the issue and the deletion on the event bus", async () => {
    const { createCreditNote, softDeleteCreditNote } = await import("../mutations")

    const invoice = await makeInvoice({ status: "sent", totalCents: 30000, currency: "EUR" })

    const result = await createCreditNote({ invoiceId: invoice.id, ...makeCreditNoteInput() })

    if ("error" in result) throw new Error(result.error)

    await softDeleteCreditNote({ id: result.data.id })

    expect(mocks.emit).toHaveBeenCalledWith("credit_note.issued", {
      creditNoteId: result.data.id,
      invoiceId: invoice.id,
      userId: ownerId
    })
    expect(mocks.emit).toHaveBeenCalledWith("credit_note.deleted", {
      creditNoteId: result.data.id,
      invoiceId: invoice.id,
      userId: ownerId
    })
  })
})
