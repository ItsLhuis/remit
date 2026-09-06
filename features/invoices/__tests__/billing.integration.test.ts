import { and, asc, eq, isNull, sql } from "drizzle-orm"

import { beforeEach, describe, expect, test, vi } from "vitest"

import { expenses, invoices, lineItems, settings, taxRates, timeEntries } from "@/database/schema"

import {
  makeClient,
  makeExpense,
  makeInvoice,
  makeProject,
  makeSettings,
  makeTask,
  makeTimeEntry,
  makeUser
} from "@/tests/factories"
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
  getCurrentRole: mocks.getCurrentRole,
  getSession: mocks.getSession
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

const ownerId = "00000000-0000-4000-8000-000000000d01"
const ownerEmail = "owner-billing@example.com"

// Proves the conversion has entered its transaction, read the entry as unbilled, and parked at
// claimInvoiceNumber's row lock — rather than sleeping and hoping. Without it the external stamp
// below could land before the in-transaction re-read, and the test would pass on the wrong guard.
async function waitUntilBlockedOnALock(): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const rows = await database.execute<{ waiting: number }>(
      sql`select count(*)::int as waiting from pg_stat_activity where wait_event_type = 'Lock'`
    )

    if (Number(rows[0]?.waiting ?? 0) > 0) return

    await new Promise((resolve) => setTimeout(resolve, 20))
  }

  throw new Error("the conversion never blocked on the settings row")
}

async function listInvoiceLines(invoiceId: string) {
  return database
    .select()
    .from(lineItems)
    .where(and(eq(lineItems.invoiceId, invoiceId), isNull(lineItems.deletedAt)))
    .orderBy(asc(lineItems.position))
}

describe("billing unbilled work", () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    await makeUser({ id: ownerId, email: ownerEmail })
    await makeSettings({
      invoicePrefix: "INV-",
      nextInvoiceNumber: 1,
      numberPaddingWidth: 4,
      paymentTermsDays: 30,
      defaultCurrency: "EUR"
    })

    mocks.headers.mockResolvedValue(
      new Headers({
        "user-agent": "Vitest",
        "x-forwarded-for": "203.0.113.50"
      })
    )
    mocks.getSession.mockResolvedValue({ user: { id: ownerId, email: ownerEmail } })
    mocks.getCurrentRole.mockResolvedValue("owner")
  })

  test("turns unbilled time into a numbered draft invoice and stamps the entries", async () => {
    const { convertBillableWork } = await import("../billing")

    const project = await makeProject({ currency: "EUR" })
    const entry = await makeTimeEntry({
      projectId: project.id,
      durationSeconds: 5400,
      hourlyRateSnapshotCents: 10_000,
      description: "Layout pass"
    })

    const result = await convertBillableWork({
      timeEntryIds: [entry.id],
      expenseIds: [],
      grouping: "entry",
      targetInvoiceId: null
    })

    expect(result).toEqual({
      data: { invoice: expect.objectContaining({ number: "INV-0001", status: "draft" }) }
    })

    const [stamped] = await database
      .select({ invoicedInId: timeEntries.invoicedInId })
      .from(timeEntries)
      .where(eq(timeEntries.id, entry.id))

    expect(stamped?.invoicedInId).not.toBeNull()
  })

  test("prices a converted line from the frozen rate snapshot", async () => {
    const { convertBillableWork } = await import("../billing")

    const project = await makeProject({ currency: "EUR" })
    const entry = await makeTimeEntry({
      projectId: project.id,
      durationSeconds: 5400,
      hourlyRateSnapshotCents: 10_000
    })

    const created = await convertBillableWork({
      timeEntryIds: [entry.id],
      expenseIds: [],
      grouping: "entry",
      targetInvoiceId: null
    })

    if ("error" in created) throw new Error(created.error)

    const lines = await listInvoiceLines(created.data.invoice.id)

    expect(lines[0]).toEqual(
      expect.objectContaining({
        quantity: "1.50",
        unitPriceCents: 10_000,
        totalCents: 15_000
      })
    )
  })

  test("names the source entry on a line drawn from one entry", async () => {
    const { convertBillableWork } = await import("../billing")

    const project = await makeProject({ currency: "EUR" })
    const entry = await makeTimeEntry({ projectId: project.id, durationSeconds: 3600 })

    const created = await convertBillableWork({
      timeEntryIds: [entry.id],
      expenseIds: [],
      grouping: "entry",
      targetInvoiceId: null
    })

    if ("error" in created) throw new Error(created.error)

    const lines = await listInvoiceLines(created.data.invoice.id)

    expect(lines[0]?.sourceTimeEntryId).toBe(entry.id)
  })

  test("leaves a grouped line without a source entry while still stamping every entry in it", async () => {
    const { convertBillableWork } = await import("../billing")

    const project = await makeProject({ currency: "EUR" })
    const task = await makeTask({ projectId: project.id, title: "Homepage" })
    const first = await makeTimeEntry({
      projectId: project.id,
      taskId: task.id,
      durationSeconds: 3600
    })
    const second = await makeTimeEntry({
      projectId: project.id,
      taskId: task.id,
      durationSeconds: 1800
    })

    const created = await convertBillableWork({
      timeEntryIds: [first.id, second.id],
      expenseIds: [],
      grouping: "task",
      targetInvoiceId: null
    })

    if ("error" in created) throw new Error(created.error)

    const lines = await listInvoiceLines(created.data.invoice.id)

    expect(lines).toHaveLength(1)
    expect(lines[0]).toEqual(expect.objectContaining({ sourceTimeEntryId: null, quantity: "1.50" }))

    const stamped = await database
      .select({ id: timeEntries.id, invoicedInId: timeEntries.invoicedInId })
      .from(timeEntries)
      .where(eq(timeEntries.projectId, project.id))

    expect(stamped.every((row) => row.invoicedInId === created.data.invoice.id)).toBe(true)
  })

  test("bills a re-billable expense at its marked-up amount and names it as the source", async () => {
    const { convertBillableWork } = await import("../billing")

    const project = await makeProject({ currency: "EUR" })
    const expense = await makeExpense({
      projectId: project.id,
      currency: "EUR",
      amountCents: 10_000,
      markupPercentage: "15.00",
      rebillable: true,
      description: "Stock photography"
    })

    const created = await convertBillableWork({
      timeEntryIds: [],
      expenseIds: [expense.id],
      grouping: "entry",
      targetInvoiceId: null
    })

    if ("error" in created) throw new Error(created.error)

    const lines = await listInvoiceLines(created.data.invoice.id)

    expect(lines[0]).toEqual(
      expect.objectContaining({
        unitPriceCents: 11_500,
        quantity: "1.00",
        sourceExpenseId: expense.id
      })
    )
    expect(lines[0]?.description).toContain("15")
  })

  test("snapshots the instance default tax rate onto every converted line", async () => {
    const { convertBillableWork } = await import("../billing")

    await database.insert(taxRates).values({ name: "VAT 23", percentage: "23.00", isDefault: true })

    const project = await makeProject({ currency: "EUR" })
    const entry = await makeTimeEntry({
      projectId: project.id,
      durationSeconds: 3600,
      hourlyRateSnapshotCents: 10_000
    })

    const created = await convertBillableWork({
      timeEntryIds: [entry.id],
      expenseIds: [],
      grouping: "entry",
      targetInvoiceId: null
    })

    if ("error" in created) throw new Error(created.error)

    const lines = await listInvoiceLines(created.data.invoice.id)

    expect(lines[0]?.taxPercentageSnapshot).toBe("23.00")
    expect(lines[0]?.taxAmountCents).toBe(2300)
  })

  test("refuses a selection spanning two currencies without billing anything", async () => {
    const { convertBillableWork } = await import("../billing")

    const project = await makeProject({ currency: "EUR" })
    const entry = await makeTimeEntry({ projectId: project.id, durationSeconds: 3600 })
    const expense = await makeExpense({
      projectId: project.id,
      currency: "USD",
      rebillable: true
    })

    const result = await convertBillableWork({
      timeEntryIds: [entry.id],
      expenseIds: [expense.id],
      grouping: "entry",
      targetInvoiceId: null
    })

    expect(result).toEqual({ error: expect.stringContaining("currency") })

    const rows = await database.select({ id: invoices.id }).from(invoices)

    expect(rows).toHaveLength(0)
  })

  test("refuses a selection spanning two clients without billing anything", async () => {
    const { convertBillableWork } = await import("../billing")

    const first = await makeProject({ currency: "EUR" })
    const second = await makeProject({ clientId: (await makeClient()).id, currency: "EUR" })
    const firstEntry = await makeTimeEntry({ projectId: first.id, durationSeconds: 3600 })
    const secondEntry = await makeTimeEntry({ projectId: second.id, durationSeconds: 3600 })

    const result = await convertBillableWork({
      timeEntryIds: [firstEntry.id, secondEntry.id],
      expenseIds: [],
      grouping: "entry",
      targetInvoiceId: null
    })

    expect(result).toEqual({ error: expect.stringContaining("client") })

    const rows = await database.select({ id: invoices.id }).from(invoices)

    expect(rows).toHaveLength(0)
  })

  test("leaves an entry too short to bill unbilled instead of charging for it", async () => {
    const { convertBillableWork } = await import("../billing")

    const project = await makeProject({ currency: "EUR" })
    const tiny = await makeTimeEntry({ projectId: project.id, durationSeconds: 10 })
    const real = await makeTimeEntry({ projectId: project.id, durationSeconds: 3600 })

    const created = await convertBillableWork({
      timeEntryIds: [tiny.id, real.id],
      expenseIds: [],
      grouping: "entry",
      targetInvoiceId: null
    })

    if ("error" in created) throw new Error(created.error)

    const [stamped] = await database
      .select({ invoicedInId: timeEntries.invoicedInId })
      .from(timeEntries)
      .where(eq(timeEntries.id, tiny.id))

    expect(stamped?.invoicedInId).toBeNull()
  })

  test("appends onto an existing draft, continuing its line positions", async () => {
    const { convertBillableWork } = await import("../billing")

    const project = await makeProject({ currency: "EUR" })
    const first = await makeTimeEntry({
      projectId: project.id,
      durationSeconds: 3600,
      hourlyRateSnapshotCents: 10_000
    })
    const second = await makeTimeEntry({
      projectId: project.id,
      durationSeconds: 3600,
      hourlyRateSnapshotCents: 10_000
    })

    const created = await convertBillableWork({
      timeEntryIds: [first.id],
      expenseIds: [],
      grouping: "entry",
      targetInvoiceId: null
    })

    if ("error" in created) throw new Error(created.error)

    const appended = await convertBillableWork({
      timeEntryIds: [second.id],
      expenseIds: [],
      grouping: "entry",
      targetInvoiceId: created.data.invoice.id
    })

    if ("error" in appended) throw new Error(appended.error)

    expect(appended.data.invoice.id).toBe(created.data.invoice.id)

    const lines = await listInvoiceLines(created.data.invoice.id)

    expect(lines.map((line) => line.position)).toEqual([0, 1])

    const [invoice] = await database
      .select({ totalCents: invoices.totalCents })
      .from(invoices)
      .where(eq(invoices.id, created.data.invoice.id))

    expect(Number(invoice?.totalCents)).toBe(20_000)
  })

  test("refuses to append onto an invoice that is no longer a draft", async () => {
    const { convertBillableWork } = await import("../billing")

    const project = await makeProject({ currency: "EUR" })
    const first = await makeTimeEntry({ projectId: project.id, durationSeconds: 3600 })
    const second = await makeTimeEntry({ projectId: project.id, durationSeconds: 3600 })

    const created = await convertBillableWork({
      timeEntryIds: [first.id],
      expenseIds: [],
      grouping: "entry",
      targetInvoiceId: null
    })

    if ("error" in created) throw new Error(created.error)

    await database
      .update(invoices)
      .set({ status: "sent" })
      .where(eq(invoices.id, created.data.invoice.id))

    const result = await convertBillableWork({
      timeEntryIds: [second.id],
      expenseIds: [],
      grouping: "entry",
      targetInvoiceId: created.data.invoice.id
    })

    expect(result).toEqual({ error: expect.any(String) })
  })

  test("bills nothing on a sequential re-run of the same selection", async () => {
    const { convertBillableWork } = await import("../billing")

    const project = await makeProject({ currency: "EUR" })
    const entry = await makeTimeEntry({ projectId: project.id, durationSeconds: 3600 })
    const expense = await makeExpense({
      projectId: project.id,
      currency: "EUR",
      rebillable: true
    })

    const selection = {
      timeEntryIds: [entry.id],
      expenseIds: [expense.id],
      grouping: "entry" as const,
      targetInvoiceId: null
    }

    const first = await convertBillableWork(selection)

    if ("error" in first) throw new Error(first.error)

    const second = await convertBillableWork(selection)

    expect(second).toEqual({ error: expect.any(String) })

    const rows = await database.select({ id: invoices.id }).from(invoices)

    expect(rows).toHaveLength(1)

    const [stampedEntry] = await database
      .select({ invoicedInId: timeEntries.invoicedInId })
      .from(timeEntries)
      .where(eq(timeEntries.id, entry.id))
    const [stampedExpense] = await database
      .select({ invoicedInId: expenses.invoicedInId })
      .from(expenses)
      .where(eq(expenses.id, expense.id))

    expect(stampedEntry?.invoicedInId).toBe(first.data.invoice.id)
    expect(stampedExpense?.invoicedInId).toBe(first.data.invoice.id)
  })

  test("bills nothing when the work is billed after this conversion planned it", async () => {
    const { convertBillableWork } = await import("../billing")

    const project = await makeProject({ currency: "EUR" })
    const entry = await makeTimeEntry({
      projectId: project.id,
      durationSeconds: 3600,
      hourlyRateSnapshotCents: 10_000
    })
    const other = await makeInvoice({ projectId: project.id, currency: "EUR" })

    let release = () => {}
    const held = new Promise<void>((resolve) => {
      release = resolve
    })

    // Holding the settings row pins the conversion inside its own transaction: claimInvoiceNumber's
    // single atomic increment cannot proceed while another transaction holds that row, and it runs
    // after the conversion has already re-read the entry as unbilled. That is precisely the window a
    // concurrent conversion occupies, reproduced without depending on two transactions interleaving
    // by luck.
    const blocker = database.transaction(async (transaction) => {
      await transaction.update(settings).set({ updatedAt: new Date() })

      await held
    })

    const conversion = convertBillableWork({
      timeEntryIds: [entry.id],
      expenseIds: [],
      grouping: "entry",
      targetInvoiceId: null
    })

    await waitUntilBlockedOnALock()

    await database
      .update(timeEntries)
      .set({ invoicedInId: other.id })
      .where(eq(timeEntries.id, entry.id))

    release()

    await blocker

    expect(await conversion).toEqual({ error: expect.any(String) })

    const [stamped] = await database
      .select({ invoicedInId: timeEntries.invoicedInId })
      .from(timeEntries)
      .where(eq(timeEntries.id, entry.id))

    expect(stamped?.invoicedInId).toBe(other.id)

    const raised = await database
      .select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.number, "INV-0001"))

    expect(raised).toHaveLength(0)
  })

  test("still refuses to edit an expense once the conversion has billed it", async () => {
    const { convertBillableWork } = await import("../billing")
    const { updateExpense } = await import("@/features/expenses/mutations")

    const project = await makeProject({ currency: "EUR" })
    const expense = await makeExpense({
      projectId: project.id,
      currency: "EUR",
      rebillable: true,
      amountCents: 10_000
    })

    const created = await convertBillableWork({
      timeEntryIds: [],
      expenseIds: [expense.id],
      grouping: "entry",
      targetInvoiceId: null
    })

    if ("error" in created) throw new Error(created.error)

    const result = await updateExpense({
      id: expense.id,
      projectId: project.id,
      clientId: "",
      category: "Software",
      description: "Edited",
      spentAt: "2026-08-06",
      amount: "200.00",
      currency: "EUR",
      rebillable: true,
      markupPercentage: "",
      receipt: null
    })

    expect(result).toEqual({ error: expect.any(String) })
  })
})
