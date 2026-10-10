import { and, asc, eq, isNull } from "drizzle-orm"

import { beforeEach, describe, expect, test, vi } from "vitest"

import { lineItems, timeEntries } from "@/database/schema"

import { makeProject, makeSettings, makeTimeEntry, makeUser } from "@/tests/factories"
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
const ownerEmail = "owner-billing-scale@example.com"

async function listInvoiceLines(invoiceId: string) {
  return database
    .select()
    .from(lineItems)
    .where(and(eq(lineItems.invoiceId, invoiceId), isNull(lineItems.deletedAt)))
    .orderBy(asc(lineItems.position))
}

describe("billing at scale", () => {
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

  // Both sizes sit past the 65,535 parameters Postgres allows one statement, which is the bound these
  // two paths used to break at: a VALUES list of four per line on append, sixteen per line on insert.
  test("appends to an invoice longer than one statement could once recompute", async () => {
    const { convertBillableWork } = await import("../billing")

    const project = await makeProject({ currency: "EUR" })
    const first = await makeTimeEntry({ projectId: project.id, durationSeconds: 3600 })
    const created = await convertBillableWork({
      timeEntryIds: [first.id],
      expenseIds: [],
      grouping: "entry",
      targetInvoiceId: null
    })

    if ("error" in created) throw new Error(created.error)

    const invoiceId = created.data.invoice.id

    for (let start = 0; start < 17_000; start += 1000) {
      await database.insert(lineItems).values(
        Array.from({ length: 1000 }, (_, index) => ({
          invoiceId,
          position: 1 + start + index,
          description: "Existing line",
          quantity: "1",
          unitPriceCents: 100,
          taxPercentageSnapshot: "0",
          subtotalCents: 100,
          taxAmountCents: 0,
          totalCents: 100
        }))
      )
    }

    const second = await makeTimeEntry({ projectId: project.id, durationSeconds: 3600 })

    const appended = await convertBillableWork({
      timeEntryIds: [second.id],
      expenseIds: [],
      grouping: "entry",
      targetInvoiceId: invoiceId
    })

    expect(appended).toEqual({ data: expect.anything() })
    expect(await listInvoiceLines(invoiceId)).toHaveLength(17_002)
  }, 120_000)

  test("bills a selection longer than one insert could once hold", async () => {
    const { convertBillableWork } = await import("../billing")

    const project = await makeProject({ currency: "EUR" })
    const entryIds: string[] = []

    for (let start = 0; start < 5000; start += 1000) {
      const rows = await database
        .insert(timeEntries)
        .values(
          Array.from({ length: 1000 }, (_, index) => {
            const startedAt = new Date(Date.UTC(2026, 0, 1, 0, start + index))

            return {
              projectId: project.id,
              startedAt,
              endedAt: new Date(startedAt.getTime() + 3_600_000),
              durationSeconds: 3600,
              hourlyRateSnapshotCents: 10_000
            }
          })
        )
        .returning({ id: timeEntries.id })

      entryIds.push(...rows.map((row) => row.id))
    }

    const result = await convertBillableWork({
      timeEntryIds: entryIds,
      expenseIds: [],
      grouping: "entry",
      targetInvoiceId: null
    })

    if ("error" in result) throw new Error(result.error)

    expect(await listInvoiceLines(result.data.invoice.id)).toHaveLength(5000)
  }, 120_000)
})
