import { eq } from "drizzle-orm"

import { beforeEach, describe, expect, test, vi } from "vitest"

import { auditLogs, invoices } from "@/database/schema"

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

const ownerId = "00000000-0000-4000-8000-000000000c02"
const ownerEmail = "owner-late-fee@example.com"

describe("invoice late fee adjustment", () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    await makeUser({ id: ownerId, email: ownerEmail })
    await makeSettings({ invoicePrefix: "INV-", nextInvoiceNumber: 1, numberPaddingWidth: 4 })

    mocks.headers.mockResolvedValue(new Headers({ "user-agent": "Vitest" }))
    mocks.getSession.mockResolvedValue({ user: { id: ownerId, email: ownerEmail } })
    mocks.getCurrentRole.mockResolvedValue("owner")
  })

  test("moves the invoice total by the difference when the fee is overridden", async () => {
    const { adjustInvoiceLateFee } = await import("../mutations")

    const invoice = await makeInvoice({
      status: "sent",
      subtotalCents: 100_000,
      totalCents: 105_000,
      lateFeeCents: 5_000
    })

    const result = await adjustInvoiceLateFee({ id: invoice.id, lateFee: "20.00" })

    expect(result).toEqual({ data: { id: invoice.id, lateFeeCents: 2_000 } })

    const [stored] = await database.select().from(invoices).where(eq(invoices.id, invoice.id))

    expect(stored).toMatchObject({ lateFeeCents: 2_000, totalCents: 102_000 })
  })

  test("settles the invoice when waiving the fee covers the whole remaining balance", async () => {
    const { adjustInvoiceLateFee } = await import("../mutations")

    const invoice = await makeInvoice({
      status: "sent",
      subtotalCents: 100_000,
      totalCents: 105_000,
      amountPaidCents: 100_000,
      lateFeeCents: 5_000
    })

    await adjustInvoiceLateFee({ id: invoice.id, lateFee: "0" })

    const [stored] = await database.select().from(invoices).where(eq(invoices.id, invoice.id))

    expect(stored).toMatchObject({ lateFeeCents: 0, totalCents: 100_000, status: "paid" })
    expect(stored?.paidAt).not.toBeNull()
  })

  test("refuses to lower the fee below what the client has already paid", async () => {
    const { adjustInvoiceLateFee } = await import("../mutations")

    const invoice = await makeInvoice({
      status: "paid",
      subtotalCents: 100_000,
      totalCents: 105_000,
      amountPaidCents: 105_000,
      paidAt: new Date("2026-08-01T00:00:00.000Z"),
      lateFeeCents: 5_000
    })

    const result = await adjustInvoiceLateFee({ id: invoice.id, lateFee: "0" })

    expect("error" in result).toBe(true)

    const [stored] = await database.select().from(invoices).where(eq(invoices.id, invoice.id))

    expect(stored).toMatchObject({ lateFeeCents: 5_000, totalCents: 105_000 })
  })

  test("refuses an invoice that carries no late fee", async () => {
    const { adjustInvoiceLateFee } = await import("../mutations")

    const invoice = await makeInvoice({ status: "sent", totalCents: 100_000 })

    const result = await adjustInvoiceLateFee({ id: invoice.id, lateFee: "10.00" })

    expect("error" in result).toBe(true)
  })

  test("refuses a role that is not the owner", async () => {
    const { adjustInvoiceLateFee } = await import("../mutations")

    mocks.getCurrentRole.mockResolvedValue("accountant")

    const invoice = await makeInvoice({
      status: "sent",
      totalCents: 105_000,
      lateFeeCents: 5_000
    })

    const result = await adjustInvoiceLateFee({ id: invoice.id, lateFee: "0" })

    expect("error" in result).toBe(true)

    const [stored] = await database.select().from(invoices).where(eq(invoices.id, invoice.id))

    expect(stored?.lateFeeCents).toBe(5_000)
  })

  test("writes an audit entry naming the previous and the new amount", async () => {
    const { adjustInvoiceLateFee } = await import("../mutations")

    const invoice = await makeInvoice({
      status: "sent",
      subtotalCents: 100_000,
      totalCents: 105_000,
      lateFeeCents: 5_000
    })

    await adjustInvoiceLateFee({ id: invoice.id, lateFee: "0" })

    const [entry] = await database
      .select({ metadata: auditLogs.metadata })
      .from(auditLogs)
      .where(eq(auditLogs.event, "invoice.late_fee.adjusted"))

    expect(entry?.metadata).toMatchObject({ previousCents: 5_000, feeCents: 0 })
  })
})
