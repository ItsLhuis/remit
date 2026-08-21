import { eq, isNull } from "drizzle-orm"

import { beforeEach, describe, expect, test, vi } from "vitest"

import { auditLogs, clientContacts } from "@/database/schema"

import { makeClient, makeClientContact, makeUser } from "@/tests/factories"
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
    warn: vi.fn()
  }
}))

const ownerId = "00000000-0000-4000-8000-000000000411"
const ownerEmail = "owner-contacts@example.com"

const validContact = {
  name: "Jordan Ellis",
  email: "jordan@example.com",
  phone: "+15550111",
  role: "Finance",
  isPrimary: false
}

describe("client contact mutations", () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    await makeUser({ id: ownerId, email: ownerEmail })

    mocks.headers.mockResolvedValue(new Headers({ "user-agent": "Vitest" }))
    mocks.getSession.mockResolvedValue({ user: { id: ownerId, email: ownerEmail } })
    mocks.getCurrentRole.mockResolvedValue("owner")
  })

  test("creates the first contact as primary even when the form left it unticked", async () => {
    const { createClientContact } = await import("../mutations")

    const client = await makeClient()

    const result = await createClientContact({ clientId: client.id, ...validContact })

    const [contact] = await database.select().from(clientContacts)
    const auditRows = await database.select().from(auditLogs)

    expect(result).toEqual({ data: { id: expect.any(String) } })
    expect(contact).toEqual(
      expect.objectContaining({ name: "Jordan Ellis", role: "Finance", isPrimary: true })
    )
    expect(auditRows[0]?.event).toBe("client_contact.created")
    expect(auditRows[0]?.targetEntityType).toBe("client_contact")
  })

  test("leaves a later contact unprimary when the slot is already taken", async () => {
    const { createClientContact } = await import("../mutations")

    const client = await makeClient()

    await makeClientContact({ clientId: client.id, isPrimary: true })
    await createClientContact({ clientId: client.id, ...validContact })

    const rows = await database
      .select()
      .from(clientContacts)
      .where(eq(clientContacts.clientId, client.id))

    expect(rows.filter((row) => row.isPrimary)).toHaveLength(1)
  })

  test("normalises blank optional fields to null", async () => {
    const { createClientContact } = await import("../mutations")

    const client = await makeClient()

    await createClientContact({
      clientId: client.id,
      ...validContact,
      phone: "",
      role: ""
    })

    const [contact] = await database.select().from(clientContacts)

    expect(contact?.phone).toBeNull()
    expect(contact?.role).toBeNull()
  })

  test("refuses a contact for a client that does not exist", async () => {
    const { createClientContact } = await import("../mutations")

    const result = await createClientContact({
      clientId: "00000000-0000-4000-8000-0000000004ff",
      ...validContact
    })

    const rows = await database.select().from(clientContacts)

    expect(result).toEqual({ error: expect.any(String) })
    expect(rows).toHaveLength(0)
  })

  test("demotes the previous primary when another contact is promoted", async () => {
    const { setPrimaryClientContact } = await import("../mutations")

    const client = await makeClient()
    const previous = await makeClientContact({ clientId: client.id, isPrimary: true })
    const next = await makeClientContact({ clientId: client.id })

    const result = await setPrimaryClientContact({ id: next.id })

    const rows = await database
      .select()
      .from(clientContacts)
      .where(eq(clientContacts.clientId, client.id))
    const auditRows = await database.select().from(auditLogs)

    expect(result).toEqual({ data: { id: next.id } })
    expect(rows.find((row) => row.id === previous.id)?.isPrimary).toBe(false)
    expect(rows.find((row) => row.id === next.id)?.isPrimary).toBe(true)
    expect(auditRows[0]?.event).toBe("client_contact.primary_changed")
  })

  test("promotes through an update without leaving two live primaries", async () => {
    const { updateClientContact } = await import("../mutations")

    const client = await makeClient()

    await makeClientContact({ clientId: client.id, isPrimary: true })

    const other = await makeClientContact({ clientId: client.id })

    await updateClientContact({ id: other.id, ...validContact, isPrimary: true })

    const rows = await database
      .select()
      .from(clientContacts)
      .where(eq(clientContacts.clientId, client.id))

    expect(rows.filter((row) => row.isPrimary)).toHaveLength(1)
    expect(rows.find((row) => row.id === other.id)?.isPrimary).toBe(true)
  })

  // The partial unique index is the real serializer, so the losing promotion must arrive as a
  // sentence rather than as a raw 23505 from the driver.
  test("returns a translated message when a promotion loses the primary slot", async () => {
    const { setPrimaryClientContact } = await import("../mutations")

    const client = await makeClient()
    const first = await makeClientContact({ clientId: client.id })
    const second = await makeClientContact({ clientId: client.id })

    const [firstResult, secondResult] = await Promise.all([
      setPrimaryClientContact({ id: first.id }),
      setPrimaryClientContact({ id: second.id })
    ])

    const rows = await database
      .select()
      .from(clientContacts)
      .where(eq(clientContacts.clientId, client.id))

    expect(rows.filter((row) => row.isPrimary)).toHaveLength(1)
    expect([firstResult, secondResult]).toContainEqual({ data: { id: expect.any(String) } })
    expect(JSON.stringify([firstResult, secondResult])).not.toContain("23505")
  })

  test("frees the primary slot when the primary contact is deleted", async () => {
    const { createClientContact, softDeleteClientContact } = await import("../mutations")

    const client = await makeClient()
    const primary = await makeClientContact({ clientId: client.id, isPrimary: true })

    const deleted = await softDeleteClientContact({ id: primary.id })
    const replacement = await createClientContact({
      clientId: client.id,
      ...validContact,
      isPrimary: true
    })

    const live = await database
      .select()
      .from(clientContacts)
      .where(isNull(clientContacts.deletedAt))

    expect(deleted).toEqual({ data: { id: primary.id } })
    expect(replacement).toEqual({ data: { id: expect.any(String) } })
    expect(live.filter((row) => row.isPrimary)).toHaveLength(1)
  })

  test("refuses every contact write for a role without client permissions", async () => {
    const { createClientContact, setPrimaryClientContact, softDeleteClientContact } =
      await import("../mutations")

    mocks.getCurrentRole.mockResolvedValue("accountant")

    const client = await makeClient()
    const contact = await makeClientContact({ clientId: client.id })

    expect(await createClientContact({ clientId: client.id, ...validContact })).toEqual({
      error: expect.any(String)
    })
    expect(await setPrimaryClientContact({ id: contact.id })).toEqual({ error: expect.any(String) })
    expect(await softDeleteClientContact({ id: contact.id })).toEqual({ error: expect.any(String) })
  })

  test("lets an assistant edit a contact but not delete one", async () => {
    const { softDeleteClientContact, updateClientContact } = await import("../mutations")

    mocks.getCurrentRole.mockResolvedValue("assistant")

    const client = await makeClient()
    const contact = await makeClientContact({ clientId: client.id })

    expect(await updateClientContact({ id: contact.id, ...validContact })).toEqual({
      data: { id: contact.id }
    })
    expect(await softDeleteClientContact({ id: contact.id })).toEqual({ error: expect.any(String) })
  })
})
