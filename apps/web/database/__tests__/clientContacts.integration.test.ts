import { eq } from "drizzle-orm"

import { describe, expect, test } from "vitest"

import { clientContacts, clients } from "@/database/schema"

import { makeClient, makeClientContact } from "@/tests/factories"
import { database } from "@/tests/integration/database"

describe("client_contacts", () => {
  test("stores several contacts for one client", async () => {
    const client = await makeClient()

    await makeClientContact({ clientId: client.id, name: "Approver", isPrimary: true })
    await makeClientContact({ clientId: client.id, name: "Signatory" })
    await makeClientContact({ clientId: client.id, name: "Finance" })

    const rows = await database
      .select()
      .from(clientContacts)
      .where(eq(clientContacts.clientId, client.id))

    expect(rows).toHaveLength(3)
  })

  test("refuses a second primary contact for the same client", async () => {
    const client = await makeClient()

    await makeClientContact({ clientId: client.id, isPrimary: true })

    await expect(makeClientContact({ clientId: client.id, isPrimary: true })).rejects.toThrow()
  })

  test("frees the primary slot when the current primary is soft deleted", async () => {
    const client = await makeClient()

    const first = await makeClientContact({ clientId: client.id, isPrimary: true })

    await database
      .update(clientContacts)
      .set({ deletedAt: new Date() })
      .where(eq(clientContacts.id, first.id))

    const replacement = await makeClientContact({ clientId: client.id, isPrimary: true })

    expect(replacement.isPrimary).toBe(true)
  })

  test("allows a primary contact for each of two clients", async () => {
    const first = await makeClient()
    const second = await makeClient()

    await makeClientContact({ clientId: first.id, isPrimary: true })
    await makeClientContact({ clientId: second.id, isPrimary: true })

    const rows = await database.select().from(clientContacts)

    expect(rows.filter((row) => row.isPrimary)).toHaveLength(2)
  })

  test("removes the contacts with the client they belong to", async () => {
    const client = await makeClient()

    await makeClientContact({ clientId: client.id })

    await database.delete(clients).where(eq(clients.id, client.id))

    expect(await database.select().from(clientContacts)).toHaveLength(0)
  })
})
