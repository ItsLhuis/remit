import { eq } from "drizzle-orm"

import { beforeEach, describe, expect, test, vi } from "vitest"

import {
  activityLogs,
  auditLogs,
  clientContacts,
  clients,
  contracts,
  contractSignatures,
  invoices,
  payments,
  projects,
  tasks
} from "@/database/schema"

import {
  makeActivityLog,
  makeClient,
  makeClientContact,
  makeContract,
  makeContractSignature,
  makeInvoice,
  makePayment,
  makeProject,
  makeTask,
  makeUser
} from "@/tests/factories"
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

const ownerId = "00000000-0000-4000-8000-000000000901"
const ownerEmail = "owner-forget@example.com"

describe("right to be forgotten", () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    await makeUser({ id: ownerId, email: ownerEmail })

    mocks.headers.mockResolvedValue(new Headers({ "user-agent": "Vitest" }))
    mocks.getSession.mockResolvedValue({ user: { id: ownerId, email: ownerEmail } })
    mocks.getCurrentRole.mockResolvedValue("owner")
  })

  test("destroys the client and its whole subgraph", async () => {
    const { forgetClient } = await import("../forgetMutations")

    const client = await makeClient({ name: "Acme Studio" })
    const project = await makeProject({ clientId: client.id })
    const task = await makeTask({ projectId: project.id })
    const contact = await makeClientContact({ clientId: client.id })
    const invoice = await makeInvoice({ projectId: project.id, clientId: client.id })
    const payment = await makePayment({ invoiceId: invoice.id })
    await makeActivityLog({ entityType: "client", entityId: client.id })

    const result = await forgetClient({ id: client.id, confirmation: "Acme Studio" })

    expect(result).toEqual({ data: { id: client.id } })
    expect(await database.select().from(clients).where(eq(clients.id, client.id))).toHaveLength(0)
    expect(await database.select().from(projects).where(eq(projects.id, project.id))).toHaveLength(
      0
    )
    expect(await database.select().from(tasks).where(eq(tasks.id, task.id))).toHaveLength(0)
    expect(
      await database.select().from(clientContacts).where(eq(clientContacts.id, contact.id))
    ).toHaveLength(0)
    expect(await database.select().from(invoices).where(eq(invoices.id, invoice.id))).toHaveLength(
      0
    )
    expect(await database.select().from(payments).where(eq(payments.id, payment.id))).toHaveLength(
      0
    )
    expect(
      await database.select().from(activityLogs).where(eq(activityLogs.entityId, client.id))
    ).toHaveLength(0)
  })

  test("refuses the erasure while a countersigned contract stands", async () => {
    const { forgetClient } = await import("../forgetMutations")

    const client = await makeClient({ name: "Signed Co" })
    const signed = await makeContract({ clientId: client.id })
    await makeContractSignature({ contractId: signed.id })
    const unsigned = await makeContract({ clientId: client.id })

    const result = await forgetClient({ id: client.id, confirmation: "Signed Co" })

    const remaining = (await database.select({ id: contracts.id }).from(contracts)).map(
      (row) => row.id
    )

    expect(result).toEqual({ error: expect.stringContaining("signed contract") })
    expect(remaining).toContain(signed.id)
    expect(remaining).toContain(unsigned.id)
    expect(await database.select().from(contractSignatures)).toHaveLength(1)
    expect(await database.select().from(clients).where(eq(clients.id, client.id))).toHaveLength(1)
  })

  test("keeps the audit trail and records the erasure without the client's name", async () => {
    const { forgetClient } = await import("../forgetMutations")

    await database.insert(auditLogs).values({ event: "auth.login.succeeded" })
    const client = await makeClient({ name: "Acme Studio", email: "billing@example.com" })

    await forgetClient({ id: client.id, confirmation: "Acme Studio" })

    const rows = await database.select().from(auditLogs)
    const forgotten = rows.find((row) => row.event === "client.forgotten")

    expect(rows.map((row) => row.event)).toContain("auth.login.succeeded")
    expect(forgotten?.targetEntityId).toBe(client.id)
    expect(JSON.stringify(forgotten?.metadata)).not.toContain("Acme Studio")
    expect(JSON.stringify(forgotten?.metadata)).not.toContain("billing@example.com")
  })

  test("refuses when the typed confirmation does not match the client name", async () => {
    const { forgetClient } = await import("../forgetMutations")

    const client = await makeClient({ name: "Acme Studio" })

    const result = await forgetClient({ id: client.id, confirmation: "acme studio" })

    expect(result).toEqual({ error: expect.any(String) })
    expect(await database.select().from(clients).where(eq(clients.id, client.id))).toHaveLength(1)
  })

  test("refuses for a role that cannot delete", async () => {
    const { forgetClient } = await import("../forgetMutations")

    mocks.getCurrentRole.mockResolvedValue("accountant")

    const client = await makeClient({ name: "Acme Studio" })

    const result = await forgetClient({ id: client.id, confirmation: "Acme Studio" })

    expect(result).toEqual({ error: expect.any(String) })
    expect(await database.select().from(clients).where(eq(clients.id, client.id))).toHaveLength(1)
  })
})
