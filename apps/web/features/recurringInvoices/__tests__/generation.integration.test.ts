import { eq } from "drizzle-orm"

import { beforeEach, describe, expect, test, vi } from "vitest"

import { auditLogs, invoices, lineItems, recurringInvoices } from "@/database/schema"

import { makeClient, makeProject, makeRecurringInvoice, makeSettings } from "@/tests/factories"
import { database } from "@/tests/integration/database"

const mocks = vi.hoisted(() => ({
  emit: vi.fn(),
  enqueueJob: vi.fn(),
  registerJobHandler: vi.fn(),
  loggerError: vi.fn()
}))

// The queue is stubbed at the module boundary rather than dialled: these tests exercise the handler
// body, and a real Redis round trip would eat the 30s budget without testing anything the worker
// does not already prove at startup.
vi.mock("@/lib/jobs", () => ({
  enqueueJob: mocks.enqueueJob,
  registerJobHandler: mocks.registerJobHandler
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

const BLUEPRINT = [
  {
    description: "Monthly retainer",
    unit: null,
    quantity: 1,
    unitPriceCents: 150_000,
    taxRateId: null,
    taxPercentage: 0,
    discountType: null,
    discountPercentage: null,
    discountAmountCents: null
  }
]

type GenerateHandler = (payload: {
  recurringInvoiceId: string
  occurrenceKey: string
}) => Promise<void>

// Cached across tests because registration is a module-load side effect: the module is imported once
// for the whole file, and `vi.clearAllMocks()` in `beforeEach` wipes the recorded registration call
// that every later test would otherwise look for.
let generateHandler: GenerateHandler | null = null

// The test reaches the handler through the same registry the worker uses, rather than exporting it
// from `jobs.ts` purely to be testable.
async function getGenerateHandler(): Promise<GenerateHandler> {
  if (generateHandler) return generateHandler

  await import("../jobs")

  const call = mocks.registerJobHandler.mock.calls.find(
    ([name]) => name === "recurring.invoice.generate"
  )

  if (!call) throw new Error("recurring.invoice.generate handler was not registered")

  generateHandler = call[1] as GenerateHandler

  return generateHandler
}

async function countInvoicesFor(recurringInvoiceId: string): Promise<number> {
  const rows = await database
    .select({ id: invoices.id })
    .from(invoices)
    .where(eq(invoices.recurringInvoiceId, recurringInvoiceId))

  return rows.length
}

beforeEach(async () => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-08-05T09:00:00.000Z"))

  await makeSettings({ invoicePrefix: "INV-", nextInvoiceNumber: 1, numberPaddingWidth: 4 })
})

describe("generation", () => {
  test("creates one invoice from the blueprint and advances the schedule", async () => {
    const schedule = await makeRecurringInvoice({
      nextRunAt: new Date(Date.UTC(2026, 7, 5)),
      cadence: "monthly",
      cadenceDay: 5,
      lineItemsBlueprint: BLUEPRINT
    })

    const generate = await getGenerateHandler()

    await generate({ recurringInvoiceId: schedule.id, occurrenceKey: "2026-08-05" })

    const [invoice] = await database
      .select()
      .from(invoices)
      .where(eq(invoices.recurringInvoiceId, schedule.id))

    expect(invoice).toMatchObject({ status: "draft", totalCents: 150_000, currency: "EUR" })

    const [updated] = await database
      .select()
      .from(recurringInvoices)
      .where(eq(recurringInvoices.id, schedule.id))

    expect(updated).toMatchObject({ occurrencesGenerated: 1, status: "active" })
    expect(updated?.nextRunAt.toISOString()).toBe("2026-09-05T00:00:00.000Z")
    expect(updated?.lastRunAt?.toISOString()).toBe("2026-08-05T00:00:00.000Z")
  })

  test("writes the blueprint lines onto the invoice", async () => {
    const schedule = await makeRecurringInvoice({
      nextRunAt: new Date(Date.UTC(2026, 7, 5)),
      lineItemsBlueprint: BLUEPRINT
    })

    const generate = await getGenerateHandler()

    await generate({ recurringInvoiceId: schedule.id, occurrenceKey: "2026-08-05" })

    const [invoice] = await database
      .select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.recurringInvoiceId, schedule.id))

    const lines = await database
      .select()
      .from(lineItems)
      .where(eq(lineItems.invoiceId, invoice?.id ?? ""))

    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({
      description: "Monthly retainer",
      unitPriceCents: 150_000,
      totalCents: 150_000
    })
  })

  test("issues the invoice as sent when the schedule auto-sends", async () => {
    const schedule = await makeRecurringInvoice({
      nextRunAt: new Date(Date.UTC(2026, 7, 5)),
      autoSend: true,
      lineItemsBlueprint: BLUEPRINT
    })

    const generate = await getGenerateHandler()

    await generate({ recurringInvoiceId: schedule.id, occurrenceKey: "2026-08-05" })

    const [invoice] = await database
      .select()
      .from(invoices)
      .where(eq(invoices.recurringInvoiceId, schedule.id))

    expect(invoice?.status).toBe("sent")
    expect(invoice?.issueDate?.toISOString()).toBe("2026-08-05T00:00:00.000Z")
  })

  test("enqueues the PDF render for the generated invoice", async () => {
    const schedule = await makeRecurringInvoice({
      nextRunAt: new Date(Date.UTC(2026, 7, 5)),
      lineItemsBlueprint: BLUEPRINT
    })

    const generate = await getGenerateHandler()

    await generate({ recurringInvoiceId: schedule.id, occurrenceKey: "2026-08-05" })

    expect(mocks.enqueueJob).toHaveBeenCalledWith(
      "invoice.pdf.render",
      expect.objectContaining({ invoiceId: expect.any(String) })
    )
  })

  test("emits recurring.invoice_generated with the occurrence index", async () => {
    const schedule = await makeRecurringInvoice({
      nextRunAt: new Date(Date.UTC(2026, 7, 5)),
      lineItemsBlueprint: BLUEPRINT
    })

    const generate = await getGenerateHandler()

    await generate({ recurringInvoiceId: schedule.id, occurrenceKey: "2026-08-05" })

    expect(mocks.emit).toHaveBeenCalledWith(
      "recurring.invoice_generated",
      expect.objectContaining({ recurringInvoiceId: schedule.id, occurrence: 1 })
    )
  })

  test("writes a system audit entry with no actor", async () => {
    const schedule = await makeRecurringInvoice({
      nextRunAt: new Date(Date.UTC(2026, 7, 5)),
      lineItemsBlueprint: BLUEPRINT
    })

    const generate = await getGenerateHandler()

    await generate({ recurringInvoiceId: schedule.id, occurrenceKey: "2026-08-05" })

    const entries = await database
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.targetEntityId, schedule.id))

    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ event: "recurring_invoice.generated", actorUserId: null })
  })
})

describe("idempotency", () => {
  // The guard this asserts is `next_run_at`, not the BullMQ job id: the second call re-reads a row
  // whose run date has already moved past this occurrence and writes nothing.
  test("does not generate a second invoice when the same occurrence runs again", async () => {
    const schedule = await makeRecurringInvoice({
      nextRunAt: new Date(Date.UTC(2026, 7, 5)),
      lineItemsBlueprint: BLUEPRINT
    })

    const generate = await getGenerateHandler()

    await generate({ recurringInvoiceId: schedule.id, occurrenceKey: "2026-08-05" })
    await generate({ recurringInvoiceId: schedule.id, occurrenceKey: "2026-08-05" })

    expect(await countInvoicesFor(schedule.id)).toBe(1)

    const [updated] = await database
      .select({ occurrencesGenerated: recurringInvoices.occurrencesGenerated })
      .from(recurringInvoices)
      .where(eq(recurringInvoices.id, schedule.id))

    expect(updated?.occurrencesGenerated).toBe(1)
  })

  test("does not generate for a schedule that is not yet due", async () => {
    const schedule = await makeRecurringInvoice({
      nextRunAt: new Date(Date.UTC(2026, 8, 5)),
      lineItemsBlueprint: BLUEPRINT
    })

    const generate = await getGenerateHandler()

    await generate({ recurringInvoiceId: schedule.id, occurrenceKey: "2026-09-05" })

    expect(await countInvoicesFor(schedule.id)).toBe(0)
  })

  test.each(["paused", "cancelled", "completed"] as const)(
    "does not generate for a %s schedule",
    async (status) => {
      const schedule = await makeRecurringInvoice({
        nextRunAt: new Date(Date.UTC(2026, 7, 5)),
        status,
        lineItemsBlueprint: BLUEPRINT
      })

      const generate = await getGenerateHandler()

      await generate({ recurringInvoiceId: schedule.id, occurrenceKey: "2026-08-05" })

      expect(await countInvoicesFor(schedule.id)).toBe(0)
    }
  )

  test("skips a schedule whose blueprint is empty rather than billing nothing", async () => {
    const schedule = await makeRecurringInvoice({
      nextRunAt: new Date(Date.UTC(2026, 7, 5)),
      lineItemsBlueprint: []
    })

    const generate = await getGenerateHandler()

    await generate({ recurringInvoiceId: schedule.id, occurrenceKey: "2026-08-05" })

    expect(await countInvoicesFor(schedule.id)).toBe(0)
    expect(mocks.loggerError).toHaveBeenCalled()
  })
})

describe("end conditions", () => {
  test("completes the schedule after its final occurrence", async () => {
    const schedule = await makeRecurringInvoice({
      nextRunAt: new Date(Date.UTC(2026, 7, 5)),
      endAfterCount: 1,
      lineItemsBlueprint: BLUEPRINT
    })

    const generate = await getGenerateHandler()

    await generate({ recurringInvoiceId: schedule.id, occurrenceKey: "2026-08-05" })

    const [updated] = await database
      .select({ status: recurringInvoices.status })
      .from(recurringInvoices)
      .where(eq(recurringInvoices.id, schedule.id))

    expect(updated?.status).toBe("completed")
    expect(await countInvoicesFor(schedule.id)).toBe(1)
  })

  test("completes without generating when the end date has already passed", async () => {
    const schedule = await makeRecurringInvoice({
      nextRunAt: new Date(Date.UTC(2026, 7, 5)),
      endByDate: new Date(Date.UTC(2026, 6, 31)),
      lineItemsBlueprint: BLUEPRINT
    })

    const generate = await getGenerateHandler()

    await generate({ recurringInvoiceId: schedule.id, occurrenceKey: "2026-08-05" })

    const [updated] = await database
      .select({ status: recurringInvoices.status })
      .from(recurringInvoices)
      .where(eq(recurringInvoices.id, schedule.id))

    expect(updated?.status).toBe("completed")
    expect(await countInvoicesFor(schedule.id)).toBe(0)
  })
})

describe("retainer", () => {
  test("bills nothing extra while the pool covers the hours worked", async () => {
    const client = await makeClient()
    const project = await makeProject({ clientId: client.id })

    const schedule = await makeRecurringInvoice({
      clientId: client.id,
      projectId: project.id,
      nextRunAt: new Date(Date.UTC(2026, 7, 5)),
      includedHours: 10,
      overageRateCents: 8500,
      lineItemsBlueprint: BLUEPRINT
    })

    const generate = await getGenerateHandler()

    await generate({ recurringInvoiceId: schedule.id, occurrenceKey: "2026-08-05" })

    const [invoice] = await database
      .select({ id: invoices.id, totalCents: invoices.totalCents })
      .from(invoices)
      .where(eq(invoices.recurringInvoiceId, schedule.id))

    const lines = await database
      .select({ id: lineItems.id })
      .from(lineItems)
      .where(eq(lineItems.invoiceId, invoice?.id ?? ""))

    expect(lines).toHaveLength(1)
    expect(invoice?.totalCents).toBe(150_000)
  })

  test("emits retainer.pool_exhausted when the pool is used up", async () => {
    const client = await makeClient()
    const project = await makeProject({ clientId: client.id })

    const schedule = await makeRecurringInvoice({
      clientId: client.id,
      projectId: project.id,
      nextRunAt: new Date(Date.UTC(2026, 7, 5)),
      includedHours: 0,
      overageRateCents: 8500,
      lineItemsBlueprint: BLUEPRINT
    })

    const generate = await getGenerateHandler()

    await generate({ recurringInvoiceId: schedule.id, occurrenceKey: "2026-08-05" })

    expect(mocks.emit).toHaveBeenCalledWith(
      "retainer.pool_exhausted",
      expect.objectContaining({ recurringInvoiceId: schedule.id, includedHours: 0 })
    )
  })
})
