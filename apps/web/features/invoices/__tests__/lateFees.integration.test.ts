import { and, eq } from "drizzle-orm"

import { beforeEach, describe, expect, test, vi } from "vitest"

import { auditLogs, invoices, settings } from "@/database/schema"

import { makeInvoice, makeSettings } from "@/tests/factories"
import { database } from "@/tests/integration/database"

const mocks = vi.hoisted(() => ({
  emit: vi.fn(),
  enqueueJob: vi.fn(),
  registerJobHandler: vi.fn(),
  loggerError: vi.fn()
}))

// Stubbed at the module boundary, like `features/recurringInvoices/__tests__/generation.integration
// .test.ts`: the sweep is reached through the same registry the worker registers into, so what is
// exercised here is the handler body against real Postgres. That a `JobMap` entry has a registered
// handler at all is proved once, for every job, by `lib/jobs/__tests__/jobCatalog.integration.test.ts`.
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

type SweepHandler = () => Promise<void>

let sweepHandler: SweepHandler | null = null

async function getOverdueSweep(): Promise<SweepHandler> {
  if (sweepHandler) return sweepHandler

  await import("../jobs")

  const call = mocks.registerJobHandler.mock.calls.find(
    ([name]) => name === "invoice.overdue.sweep"
  )

  if (!call) throw new Error("invoice.overdue.sweep handler was not registered")

  sweepHandler = call[1] as SweepHandler

  return sweepHandler
}

async function makeOverdueInvoice(overrides?: { totalCents?: number; amountPaidCents?: number }) {
  return await makeInvoice({
    status: "sent",
    issueDate: new Date(Date.UTC(2026, 6, 1)),
    dueDate: new Date(Date.UTC(2026, 6, 15)),
    subtotalCents: overrides?.totalCents ?? 100_000,
    totalCents: overrides?.totalCents ?? 100_000,
    amountPaidCents: overrides?.amountPaidCents ?? 0
  })
}

async function enablePercentagePolicy(overrides?: {
  lateFeePercentage?: string
  lateFeeGraceDays?: number
  lateFeeMaxCents?: number | null
}) {
  await makeSettings({
    lateFeeEnabled: true,
    lateFeeType: "percentage",
    lateFeePercentage: overrides?.lateFeePercentage ?? "5.00",
    lateFeeGraceDays: overrides?.lateFeeGraceDays ?? 0,
    lateFeeMaxCents: overrides?.lateFeeMaxCents ?? null
  })
}

async function readInvoice(invoiceId: string) {
  const [row] = await database.select().from(invoices).where(eq(invoices.id, invoiceId))

  return row ?? null
}

async function countLateFeeAudits(invoiceId: string): Promise<number> {
  const rows = await database
    .select({ id: auditLogs.id })
    .from(auditLogs)
    .where(
      and(eq(auditLogs.event, "invoice.late_fee.applied"), eq(auditLogs.targetEntityId, invoiceId))
    )

  return rows.length
}

beforeEach(async () => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-08-01T02:15:00.000Z"))
})

describe("late fee application", () => {
  test("charges nothing on a freshly migrated instance that has configured no policy", async () => {
    const invoice = await makeOverdueInvoice()

    const sweep = await getOverdueSweep()

    await sweep()

    const [settingsRow] = await database.select().from(settings)

    expect(settingsRow).toBeUndefined()

    const charged = await readInvoice(invoice.id)

    expect(charged).toMatchObject({ lateFeeCents: null, totalCents: 100_000 })
  })

  test("charges nothing when a settings row exists with the policy left off", async () => {
    await makeSettings()

    const invoice = await makeOverdueInvoice()

    const sweep = await getOverdueSweep()

    await sweep()

    const charged = await readInvoice(invoice.id)

    expect(charged).toMatchObject({ lateFeeCents: null, totalCents: 100_000 })
  })

  test("charges the fee once and adds it into the invoice total", async () => {
    await enablePercentagePolicy()

    const invoice = await makeOverdueInvoice()

    const sweep = await getOverdueSweep()

    await sweep()

    const charged = await readInvoice(invoice.id)

    expect(charged).toMatchObject({ lateFeeCents: 5_000, totalCents: 105_000, status: "sent" })
  })

  test("charges nothing more when the sweep runs again the same night", async () => {
    await enablePercentagePolicy()

    const invoice = await makeOverdueInvoice()

    const sweep = await getOverdueSweep()

    await sweep()
    await sweep()

    const charged = await readInvoice(invoice.id)

    expect(charged).toMatchObject({ lateFeeCents: 5_000, totalCents: 105_000 })
    expect(await countLateFeeAudits(invoice.id)).toBe(1)
  })

  test("charges nothing on an invoice that is already paid", async () => {
    await enablePercentagePolicy()

    const invoice = await makeInvoice({
      status: "paid",
      issueDate: new Date(Date.UTC(2026, 6, 1)),
      dueDate: new Date(Date.UTC(2026, 6, 15)),
      subtotalCents: 100_000,
      totalCents: 100_000,
      amountPaidCents: 100_000,
      paidAt: new Date(Date.UTC(2026, 6, 20))
    })

    const sweep = await getOverdueSweep()

    await sweep()

    const charged = await readInvoice(invoice.id)

    expect(charged).toMatchObject({ lateFeeCents: null, totalCents: 100_000 })
  })

  test("charges nothing on a draft", async () => {
    await enablePercentagePolicy()

    const invoice = await makeInvoice({
      status: "draft",
      dueDate: new Date(Date.UTC(2026, 6, 15)),
      subtotalCents: 100_000,
      totalCents: 100_000
    })

    const sweep = await getOverdueSweep()

    await sweep()

    const charged = await readInvoice(invoice.id)

    expect(charged?.lateFeeCents).toBeNull()
  })

  test("charges nothing while the invoice is inside the grace period", async () => {
    await enablePercentagePolicy({ lateFeeGraceDays: 30 })

    const invoice = await makeOverdueInvoice()

    const sweep = await getOverdueSweep()

    await sweep()

    const charged = await readInvoice(invoice.id)

    expect(charged?.lateFeeCents).toBeNull()
  })

  test("prices the fee on the outstanding balance of a partly paid invoice", async () => {
    await enablePercentagePolicy()

    const invoice = await makeOverdueInvoice({ amountPaidCents: 60_000 })

    const sweep = await getOverdueSweep()

    await sweep()

    const charged = await readInvoice(invoice.id)

    expect(charged).toMatchObject({ lateFeeCents: 2_000, totalCents: 102_000 })
  })

  test("records the policy and the days late in the audit entry", async () => {
    await enablePercentagePolicy({ lateFeeGraceDays: 3 })

    const invoice = await makeOverdueInvoice()

    const sweep = await getOverdueSweep()

    await sweep()

    const [entry] = await database
      .select({ metadata: auditLogs.metadata })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.event, "invoice.late_fee.applied"),
          eq(auditLogs.targetEntityId, invoice.id)
        )
      )

    expect(entry?.metadata).toMatchObject({
      feeCents: 5_000,
      daysLate: 17,
      policy: { kind: "percentage", percentage: 5, graceDays: 3 }
    })
  })

  test("emits the late-fee event once the write has landed", async () => {
    await enablePercentagePolicy()

    const invoice = await makeOverdueInvoice()

    const sweep = await getOverdueSweep()

    await sweep()

    expect(mocks.emit).toHaveBeenCalledWith("invoice.late_fee_applied", {
      invoiceId: invoice.id,
      clientId: invoice.clientId,
      feeCents: 5_000,
      daysLate: 17
    })
  })

  test("leaves a waived fee waived when the sweep runs again", async () => {
    await enablePercentagePolicy()

    const invoice = await makeOverdueInvoice()

    const sweep = await getOverdueSweep()

    await sweep()

    await database
      .update(invoices)
      .set({ lateFeeCents: 0, totalCents: 100_000 })
      .where(eq(invoices.id, invoice.id))

    await sweep()

    const charged = await readInvoice(invoice.id)

    expect(charged).toMatchObject({ lateFeeCents: 0, totalCents: 100_000 })
    expect(await countLateFeeAudits(invoice.id)).toBe(1)
  })
})
