import { and, asc, eq, isNull } from "drizzle-orm"

import { beforeEach, describe, expect, test, vi } from "vitest"

import { auditLogs, invoices, payments } from "@/database/schema"

import { makeInvoice, makePayment, makeSettings, makeUser } from "@/tests/factories"
import { database } from "@/tests/integration/database"

const mocks = vi.hoisted(() => ({
  emit: vi.fn(),
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

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.loggerError,
    fatal: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  }
}))

const ownerId = "00000000-0000-4000-8000-000000000d01"
const ownerEmail = "owner-payments@example.com"

function makePaymentInput(overrides?: Record<string, unknown>) {
  return {
    amount: "100.00",
    paidAt: "2026-07-01",
    method: "bank_transfer",
    reference: "",
    notes: "",
    ...overrides
  }
}

async function makeSentInvoice(totalCents: number) {
  return makeInvoice({ status: "sent", totalCents, currency: "EUR" })
}

async function readInvoice(invoiceId: string) {
  const row = await database.query.invoices.findFirst({ where: eq(invoices.id, invoiceId) })

  if (!row) throw new Error("readInvoice: invoice missing")

  return row
}

async function listRecordedPayments(invoiceId: string) {
  return database
    .select()
    .from(payments)
    .where(and(eq(payments.invoiceId, invoiceId), isNull(payments.deletedAt)))
    .orderBy(asc(payments.createdAt))
}

describe("payment mutations", () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    await makeUser({ id: ownerId, email: ownerEmail })
    await makeSettings({})

    mocks.headers.mockResolvedValue(
      new Headers({
        "user-agent": "Vitest",
        "x-forwarded-for": "203.0.113.50, 198.51.100.2"
      })
    )
    mocks.getSession.mockResolvedValue({ user: { id: ownerId, email: ownerEmail } })
    mocks.getCurrentRole.mockResolvedValue("owner")
  })

  test("records a partial payment and leaves the invoice unsettled", async () => {
    const { recordPayment } = await import("../mutations")

    const invoice = await makeSentInvoice(30000)

    const result = await recordPayment({ invoiceId: invoice.id, ...makePaymentInput() })

    expect("data" in result).toBe(true)

    const updated = await readInvoice(invoice.id)

    expect(Number(updated.amountPaidCents)).toBe(10000)
    expect(updated.status).toBe("sent")
    expect(updated.paidAt).toBeNull()
  })

  test("derives partially paid without ever storing it as the invoice status", async () => {
    const { recordPayment } = await import("../mutations")
    const { deriveInvoiceStatusView } = await import("@/features/invoices")

    const invoice = await makeSentInvoice(30000)

    await recordPayment({ invoiceId: invoice.id, ...makePaymentInput() })

    const updated = await readInvoice(invoice.id)

    expect(updated.status).toBe("sent")
    expect(
      deriveInvoiceStatusView(
        {
          status: updated.status,
          dueDate: updated.dueDate,
          paidAt: updated.paidAt,
          amountPaidCents: Number(updated.amountPaidCents),
          totalCents: Number(updated.totalCents)
        },
        new Date("2026-07-02T00:00:00.000Z")
      )
    ).toBe("partially_paid")
  })

  test("moves the invoice to paid when the payments reach the total", async () => {
    const { recordPayment } = await import("../mutations")

    const invoice = await makeSentInvoice(30000)

    await recordPayment({ invoiceId: invoice.id, ...makePaymentInput({ amount: "100.00" }) })
    await recordPayment({ invoiceId: invoice.id, ...makePaymentInput({ amount: "200.00" }) })

    const updated = await readInvoice(invoice.id)

    expect(Number(updated.amountPaidCents)).toBe(30000)
    expect(updated.status).toBe("paid")
    expect(updated.paidAt).not.toBeNull()
  })

  test("rejects a payment that would pay more than the invoice total", async () => {
    const { recordPayment } = await import("../mutations")

    const invoice = await makeSentInvoice(30000)

    await recordPayment({ invoiceId: invoice.id, ...makePaymentInput({ amount: "250.00" }) })

    const rejected = await recordPayment({
      invoiceId: invoice.id,
      ...makePaymentInput({ amount: "100.00" })
    })

    expect(rejected).toEqual({ error: expect.stringContaining("credit note") })

    const updated = await readInvoice(invoice.id)

    expect(Number(updated.amountPaidCents)).toBe(25000)
    expect(await listRecordedPayments(invoice.id)).toHaveLength(1)
  })

  test("refuses a payment against an invoice that has not been sent", async () => {
    const { recordPayment } = await import("../mutations")

    const invoice = await makeInvoice({ status: "draft", totalCents: 30000, currency: "EUR" })

    const rejected = await recordPayment({ invoiceId: invoice.id, ...makePaymentInput() })

    expect("error" in rejected).toBe(true)
    expect(await listRecordedPayments(invoice.id)).toHaveLength(0)
  })

  test("recalculates the aggregate when a payment is soft deleted", async () => {
    const { recordPayment, softDeletePayment } = await import("../mutations")

    const invoice = await makeSentInvoice(30000)

    await recordPayment({ invoiceId: invoice.id, ...makePaymentInput({ amount: "100.00" }) })

    const second = await recordPayment({
      invoiceId: invoice.id,
      ...makePaymentInput({ amount: "200.00" })
    })

    if ("error" in second) throw new Error(second.error)

    await softDeletePayment({ id: second.data.id })

    const updated = await readInvoice(invoice.id)

    expect(Number(updated.amountPaidCents)).toBe(10000)
    expect(await listRecordedPayments(invoice.id)).toHaveLength(1)
  })

  test("returns a settled invoice to sent when the payment behind it is removed", async () => {
    const { recordPayment, softDeletePayment } = await import("../mutations")

    const invoice = await makeSentInvoice(30000)

    const recorded = await recordPayment({
      invoiceId: invoice.id,
      ...makePaymentInput({ amount: "300.00" })
    })

    if ("error" in recorded) throw new Error(recorded.error)

    expect((await readInvoice(invoice.id)).status).toBe("paid")

    await softDeletePayment({ id: recorded.data.id })

    const updated = await readInvoice(invoice.id)

    expect(updated.status).toBe("sent")
    expect(updated.paidAt).toBeNull()
    expect(Number(updated.amountPaidCents)).toBe(0)
  })

  test("emits payment.received exactly once for one recorded payment", async () => {
    const { recordPayment } = await import("../mutations")

    const invoice = await makeSentInvoice(30000)

    await recordPayment({ invoiceId: invoice.id, ...makePaymentInput() })

    const received = mocks.emit.mock.calls.filter(([event]) => event === "payment.received")

    expect(received).toHaveLength(1)
  })

  test("announces the invoice as paid only when the aggregate reaches the total", async () => {
    const { recordPayment } = await import("../mutations")

    const invoice = await makeSentInvoice(30000)

    await recordPayment({ invoiceId: invoice.id, ...makePaymentInput({ amount: "100.00" }) })

    expect(mocks.emit.mock.calls.filter(([event]) => event === "invoice.paid")).toHaveLength(0)

    await recordPayment({ invoiceId: invoice.id, ...makePaymentInput({ amount: "200.00" }) })

    expect(mocks.emit.mock.calls.filter(([event]) => event === "invoice.paid")).toHaveLength(1)
  })

  test("holds the aggregate to the sum of the payments when two land at once", async () => {
    const { recordPayment } = await import("../mutations")

    const invoice = await makeSentInvoice(30000)

    const [first, second] = await Promise.all([
      recordPayment({ invoiceId: invoice.id, ...makePaymentInput({ amount: "200.00" }) }),
      recordPayment({ invoiceId: invoice.id, ...makePaymentInput({ amount: "200.00" }) })
    ])

    const accepted = [first, second].filter((result) => "data" in result)
    const recorded = await listRecordedPayments(invoice.id)
    const updated = await readInvoice(invoice.id)

    expect(accepted).toHaveLength(1)
    expect(recorded).toHaveLength(1)
    expect(Number(updated.amountPaidCents)).toBe(20000)
  })

  test("refuses to edit a payment the Stripe receiver wrote", async () => {
    const { updatePayment } = await import("../mutations")

    const invoice = await makeSentInvoice(30000)
    const payment = await makePayment({
      invoiceId: invoice.id,
      method: "stripe",
      amountCents: 10000,
      stripePaymentIntentId: "pi_locked_row"
    })

    const rejected = await updatePayment({ id: payment.id, ...makePaymentInput() })

    expect("error" in rejected).toBe(true)
  })

  test("re-checks the total when an edit changes the amount", async () => {
    const { recordPayment, updatePayment } = await import("../mutations")

    const invoice = await makeSentInvoice(30000)

    const recorded = await recordPayment({
      invoiceId: invoice.id,
      ...makePaymentInput({ amount: "100.00" })
    })

    if ("error" in recorded) throw new Error(recorded.error)

    const rejected = await updatePayment({
      id: recorded.data.id,
      ...makePaymentInput({ amount: "400.00" })
    })

    expect("error" in rejected).toBe(true)

    await updatePayment({ id: recorded.data.id, ...makePaymentInput({ amount: "300.00" }) })

    const updated = await readInvoice(invoice.id)

    expect(Number(updated.amountPaidCents)).toBe(30000)
    expect(updated.status).toBe("paid")
  })

  test("refuses a payment write from a role that may not record money", async () => {
    const { recordPayment } = await import("../mutations")

    mocks.getCurrentRole.mockResolvedValue("assistant")

    const invoice = await makeSentInvoice(30000)

    const rejected = await recordPayment({ invoiceId: invoice.id, ...makePaymentInput() })

    expect("error" in rejected).toBe(true)
    expect(await listRecordedPayments(invoice.id)).toHaveLength(0)
  })

  test("writes an audit entry naming the invoice the payment settles", async () => {
    const { recordPayment } = await import("../mutations")

    const invoice = await makeSentInvoice(30000)

    await recordPayment({ invoiceId: invoice.id, ...makePaymentInput() })

    const entries = await database
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.event, "payment.recorded"))

    expect(entries).toHaveLength(1)
    expect(entries[0]?.ipAddress).toBe("203.0.113.50")
    expect(entries[0]?.metadata).toMatchObject({ invoiceId: invoice.id, amountCents: 10000 })
  })
})

describe("mark as paid through the payments aggregate", () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    await makeUser({ id: ownerId, email: ownerEmail })
    await makeSettings({})

    mocks.headers.mockResolvedValue(new Headers({ "user-agent": "Vitest" }))
    mocks.getSession.mockResolvedValue({ user: { id: ownerId, email: ownerEmail } })
    mocks.getCurrentRole.mockResolvedValue("owner")
  })

  test("books the outstanding balance as a payment instead of writing the total directly", async () => {
    const { markInvoicePaid } = await import("@/features/invoices/mutations")

    const invoice = await makeSentInvoice(30000)

    const result = await markInvoicePaid({ id: invoice.id })

    expect("data" in result).toBe(true)

    const recorded = await listRecordedPayments(invoice.id)
    const updated = await readInvoice(invoice.id)

    expect(recorded).toHaveLength(1)
    expect(Number(recorded[0]?.amountCents)).toBe(30000)
    expect(Number(updated.amountPaidCents)).toBe(30000)
    expect(updated.status).toBe("paid")
  })

  test("settles only what is still outstanding after a partial payment", async () => {
    const { recordPayment } = await import("../mutations")
    const { markInvoicePaid } = await import("@/features/invoices/mutations")

    const invoice = await makeSentInvoice(30000)

    await recordPayment({ invoiceId: invoice.id, ...makePaymentInput({ amount: "100.00" }) })
    await markInvoicePaid({ id: invoice.id })

    const recorded = await listRecordedPayments(invoice.id)
    const updated = await readInvoice(invoice.id)

    expect(recorded.map((payment) => Number(payment.amountCents))).toEqual([10000, 20000])
    expect(Number(updated.amountPaidCents)).toBe(30000)
    expect(updated.status).toBe("paid")
  })

  test("announces the settled invoice exactly once", async () => {
    const { markInvoicePaid } = await import("@/features/invoices/mutations")

    const invoice = await makeSentInvoice(30000)

    await markInvoicePaid({ id: invoice.id })

    expect(mocks.emit.mock.calls.filter(([event]) => event === "invoice.paid")).toHaveLength(1)
    expect(mocks.emit.mock.calls.filter(([event]) => event === "payment.received")).toHaveLength(1)
  })
})
