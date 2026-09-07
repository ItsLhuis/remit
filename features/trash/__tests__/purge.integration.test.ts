import { eq } from "drizzle-orm"

import { beforeEach, describe, expect, test, vi } from "vitest"

import {
  auditLogs,
  clients,
  contracts,
  contractSignatures,
  invoices,
  settings
} from "@/database/schema"

import { DOMAIN_DATA_INVENTORY } from "@/scripts/core/domainData/inventory"
import {
  makeClient,
  makeContract,
  makeContractSignature,
  makeInvoice,
  makeSettings,
  makeUser
} from "@/tests/factories"
import { database } from "@/tests/integration/database"

const mocks = vi.hoisted(() => ({
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

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.loggerError,
    fatal: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  }
}))

// The clock is injected rather than frozen: `runRetentionPurge` takes `now` as an argument for
// exactly this reason, and `vi.useFakeTimers()` here would stall the postgres driver's own timers
// and hang every query in the file.
const NOW = new Date("2026-06-01T12:00:00.000Z")

// Deleted 40 days before `NOW`: outside a 30-day window, inside a 90-day one.
const OLD = new Date("2026-04-22T12:00:00.000Z")

// Deleted 29 days before `NOW`: inside a 30-day window by one day.
const RECENT = new Date("2026-05-03T12:00:00.000Z")

const ownerId = "00000000-0000-4000-8000-000000000851"
const ownerEmail = "owner-purge@example.com"

describe("retention purge", () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    await makeUser({ id: ownerId, email: ownerEmail })

    mocks.headers.mockResolvedValue(new Headers({ "user-agent": "Vitest" }))
    mocks.getSession.mockResolvedValue({ user: { id: ownerId, email: ownerEmail } })
    mocks.getCurrentRole.mockResolvedValue("owner")
  })

  test("destroys nothing on a freshly migrated instance", async () => {
    const { runRetentionPurge } = await import("../purge")

    await makeSettings()
    const client = await makeClient({ deletedAt: OLD })

    const result = await runRetentionPurge({ trashDays: null, financialDays: null }, NOW)
    const [survivor] = await database.select().from(clients).where(eq(clients.id, client.id))

    expect(result.totalRows).toBe(0)
    expect(survivor).toBeDefined()
  })

  test("removes a record outside the window and keeps one inside it", async () => {
    const { runRetentionPurge } = await import("../purge")

    const expired = await makeClient({ deletedAt: OLD })
    const recent = await makeClient({ deletedAt: RECENT })
    const live = await makeClient()

    await runRetentionPurge({ trashDays: 30, financialDays: 3650 }, NOW)

    const remaining = (await database.select({ id: clients.id }).from(clients)).map((row) => row.id)

    expect(remaining).not.toContain(expired.id)
    expect(remaining).toContain(recent.id)
    expect(remaining).toContain(live.id)
  })

  test("applies the financial window to invoices rather than the general one", async () => {
    const { runRetentionPurge } = await import("../purge")

    const invoice = await makeInvoice({ deletedAt: OLD })

    await runRetentionPurge({ trashDays: 30, financialDays: 3650 }, NOW)

    const [survivor] = await database.select().from(invoices).where(eq(invoices.id, invoice.id))

    expect(survivor).toBeDefined()
  })

  test("leaves a signed contract in place rather than cascading into its signature", async () => {
    const { runRetentionPurge } = await import("../purge")

    const signed = await makeContract({ deletedAt: OLD })
    await makeContractSignature({ contractId: signed.id })
    const unsigned = await makeContract({ deletedAt: OLD })

    await runRetentionPurge({ trashDays: 30, financialDays: 30 }, NOW)

    const remaining = (await database.select({ id: contracts.id }).from(contracts)).map(
      (row) => row.id
    )
    const signatures = await database.select().from(contractSignatures)

    expect(remaining).toContain(signed.id)
    expect(remaining).not.toContain(unsigned.id)
    expect(signatures).toHaveLength(1)
  })

  test("keeps every audit entry written before it and adds its own", async () => {
    const { runRetentionPurge } = await import("../purge")

    await database.insert(auditLogs).values({ event: "auth.login.succeeded" })
    await makeClient({ deletedAt: OLD })

    await runRetentionPurge({ trashDays: 30, financialDays: 30 }, NOW)

    const events = (await database.select().from(auditLogs)).map((row) => row.event)

    expect(events).toContain("auth.login.succeeded")
    expect(events).toContain("retention.purge.completed")
  })

  test("walks the inventory order so a parent is never deleted before its children", async () => {
    const { getPurgeOrder } = await import("../purge")

    const order = getPurgeOrder().map((entry) => entry.table)
    const inventoryOrder = DOMAIN_DATA_INVENTORY.filter(
      (entry) => entry.trash === "restorable"
    ).map((entry) => entry.table)

    expect(order).toEqual(inventoryOrder)
    expect(order.indexOf("payments")).toBeLessThan(order.indexOf("invoices"))
    expect(order.indexOf("credit_notes")).toBeLessThan(order.indexOf("invoices"))
    expect(order.indexOf("tasks")).toBeLessThan(order.indexOf("projects"))
    expect(order.indexOf("projects")).toBeLessThan(order.indexOf("clients"))
  })

  test("reports what it would remove without writing anything", async () => {
    const { planRetentionPurge } = await import("../purge")

    await makeClient({ deletedAt: OLD })

    const plan = await planRetentionPurge({ trashDays: 30, financialDays: 3650 }, NOW)
    const remaining = await database.select().from(clients)
    const auditRows = await database.select().from(auditLogs)

    expect(plan.entries.find((entry) => entry.table === "clients")?.rows).toBe(1)
    expect(remaining).toHaveLength(1)
    expect(auditRows).toHaveLength(0)
  })

  test("keeps a client whose documents still reference it", async () => {
    const { runRetentionPurge } = await import("../purge")

    const client = await makeClient({ deletedAt: OLD })
    await makeInvoice({ clientId: client.id })

    await runRetentionPurge({ trashDays: 30, financialDays: 3650 }, NOW)

    const [survivor] = await database.select().from(clients).where(eq(clients.id, client.id))

    expect(survivor).toBeDefined()
  })

  test("stores both windows on the settings row", async () => {
    const { saveRetentionPolicy } = await import("../mutations")

    await makeSettings()

    await saveRetentionPolicy({ trashDays: "30", financialDays: "2555" })

    const [row] = await database.select().from(settings)

    expect(row?.retentionTrashDays).toBe(30)
    expect(row?.retentionFinancialDays).toBe(2555)
  })
})
