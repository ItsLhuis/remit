import { beforeEach, describe, expect, test, vi } from "vitest"

import { eq, isNotNull, isNull } from "drizzle-orm"

import { auditLogs, clients } from "@/database/schema"

import { database } from "@/tests/integration/database"
import { makeClient, makeUser } from "@/tests/factories"

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
    warn: vi.fn()
  }
}))

const ownerId = "00000000-0000-4000-8000-000000000401"
const ownerEmail = "owner-clients@example.com"

const validClient = {
  name: "Acme Studio",
  email: "billing@example.com",
  phone: "+15550100",
  currency: "EUR",
  taxId: "VAT123",
  addressLine1: "1 Main Street",
  addressLine2: "",
  city: "Portland",
  state: "OR",
  postalCode: "97201",
  country: "US",
  notes: "Confidential renewal terms",
  website: "https://example.com"
}

describe("client mutations", () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    await makeUser({ id: ownerId, email: ownerEmail })

    mocks.headers.mockResolvedValue(
      new Headers({
        "user-agent": "Vitest",
        "x-forwarded-for": "203.0.113.50, 198.51.100.2"
      })
    )
    mocks.getSession.mockResolvedValue({
      user: { id: ownerId, email: ownerEmail }
    })
    mocks.getCurrentRole.mockResolvedValue("owner")
  })

  test("creates a client and audits only non-sensitive field metadata", async () => {
    const { createClient } = await import("../mutations")

    const result = await createClient(validClient)
    const [clientRow] = await database.select().from(clients)
    const auditRows = await database.select().from(auditLogs)

    expect(result).toEqual({
      data: {
        client: expect.objectContaining({
          name: "Acme Studio",
          email: "billing@example.com",
          notes: "Confidential renewal terms"
        })
      }
    })
    expect(clientRow).toEqual(
      expect.objectContaining({
        name: "Acme Studio",
        email: "billing@example.com",
        deletedAt: null
      })
    )
    expect(auditRows[0]?.event).toBe("client.created")
    expect(auditRows[0]?.targetEntityType).toBe("client")
    expect(JSON.stringify(auditRows[0]?.metadata)).not.toContain("Confidential renewal terms")
    expect(JSON.stringify(auditRows[0]?.metadata)).not.toContain("notes")
    expect(mocks.emit).toHaveBeenCalledWith("client.created", {
      clientId: clientRow?.id,
      userId: ownerId
    })
  })

  test("updates a client without writing notes to audit metadata", async () => {
    const { updateClient } = await import("../mutations")

    const existingClient = await makeClient({
      name: "Old Name",
      email: "old@example.com",
      currency: "EUR",
      notes: "Old confidential note"
    })

    const result = await updateClient({
      ...validClient,
      id: existingClient.id,
      name: "Updated Name",
      notes: "New confidential note"
    })
    const [clientRow] = await database
      .select()
      .from(clients)
      .where(eq(clients.id, existingClient.id))
    const auditRows = await database.select().from(auditLogs)

    expect(result).toEqual({
      data: {
        client: expect.objectContaining({
          id: existingClient.id,
          name: "Updated Name",
          notes: "New confidential note"
        })
      }
    })
    expect(clientRow?.name).toBe("Updated Name")
    expect(clientRow?.notes).toBe("New confidential note")
    expect(auditRows[0]?.event).toBe("client.updated")
    expect(JSON.stringify(auditRows[0]?.metadata)).not.toContain("New confidential note")
    expect(JSON.stringify(auditRows[0]?.metadata)).not.toContain("notes")
    expect(mocks.emit).toHaveBeenCalledWith(
      "client.updated",
      expect.objectContaining({
        clientId: existingClient.id,
        userId: ownerId
      })
    )
  })

  test("soft deletes a client and hides it from normal list queries", async () => {
    const { softDeleteClient } = await import("../mutations")
    const { listClients } = await import("../queries")
    const { parseClientListQuery } = await import("../schemas")

    const existingClient = await makeClient({ name: "Delete Me", email: "delete@example.com" })

    const result = await softDeleteClient({ id: existingClient.id })
    const deletedRows = await database.select().from(clients).where(isNotNull(clients.deletedAt))
    const activeRows = await database.select().from(clients).where(isNull(clients.deletedAt))
    const list = await listClients(parseClientListQuery({}))
    const auditRows = await database.select().from(auditLogs)

    expect(result).toEqual({ data: { id: existingClient.id } })
    expect(deletedRows).toEqual([expect.objectContaining({ id: existingClient.id })])
    expect(activeRows).toHaveLength(0)
    expect(list.rows).toHaveLength(0)
    expect(auditRows[0]?.event).toBe("client.deleted")
    expect(JSON.stringify(auditRows[0]?.metadata)).not.toContain("notes")
    expect(mocks.emit).toHaveBeenCalledWith("client.deleted", {
      clientId: existingClient.id,
      userId: ownerId
    })
  })

  test("prevents assistants from deleting clients", async () => {
    const { softDeleteClient } = await import("../mutations")

    const existingClient = await makeClient({ name: "Keep Me", email: "keep@example.com" })
    mocks.getCurrentRole.mockResolvedValueOnce("assistant")

    const result = await softDeleteClient({ id: existingClient.id })
    const activeRows = await database.select().from(clients).where(isNull(clients.deletedAt))

    expect(result).toEqual({ error: "You do not have permission to do that" })
    expect(activeRows).toHaveLength(1)
  })
})
