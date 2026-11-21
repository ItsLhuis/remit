import { beforeEach, describe, expect, test } from "vitest"

import { clients } from "@/database/schema"

import { makeClient, makeClientContact } from "@/tests/factories"
import { database } from "@/tests/integration/database"

import {
  getClientDocumentRecipient,
  listClientContacts,
  listClientRecipientIdentities
} from "../contactQueries"

let client: Awaited<ReturnType<typeof makeClient>>

beforeEach(async () => {
  client = await makeClient({ name: "Acme Studio", email: "billing@acme.test" })
})

describe("listClientContacts", () => {
  test("returns live contacts primary first and hides deleted ones", async () => {
    await makeClientContact({ clientId: client.id, name: "Zoe Vance" })
    await makeClientContact({ clientId: client.id, name: "Sam Reyes", isPrimary: true })
    await makeClientContact({ clientId: client.id, name: "Gone Away", deletedAt: new Date() })

    const contacts = await listClientContacts({ id: client.id })

    expect(contacts.map((contact) => contact.name)).toEqual(["Sam Reyes", "Zoe Vance"])
    expect(contacts[0]?.isPrimary).toBe(true)
  })

  test("returns nothing for a client id that is not a uuid", async () => {
    await makeClientContact({ clientId: client.id })

    expect(await listClientContacts({ id: "not-a-uuid" })).toEqual([])
  })
})

describe("getClientDocumentRecipient", () => {
  test("prefers the primary contact over the client's own address", async () => {
    await makeClientContact({
      clientId: client.id,
      name: "Sam Reyes",
      email: "finance@acme.test",
      isPrimary: true
    })

    expect(await getClientDocumentRecipient(client.id)).toEqual({
      email: "finance@acme.test",
      name: "Sam Reyes"
    })
  })

  test("falls back to the client's own address when no contact holds the slot", async () => {
    await makeClientContact({ clientId: client.id, email: "nobody@acme.test" })

    expect(await getClientDocumentRecipient(client.id)).toEqual({
      email: "billing@acme.test",
      name: "Acme Studio"
    })
  })

  test("falls back once the primary contact is soft-deleted", async () => {
    await makeClientContact({
      clientId: client.id,
      email: "former@acme.test",
      isPrimary: true,
      deletedAt: new Date()
    })

    expect(await getClientDocumentRecipient(client.id)).toEqual({
      email: "billing@acme.test",
      name: "Acme Studio"
    })
  })

  // The security property of the whole surface: a contact belongs to exactly one client, and no
  // read may let one client's document reach another client's people.
  test("never resolves to a contact belonging to a different client", async () => {
    const other = await makeClient({ email: "other@example.test" })

    await makeClientContact({
      clientId: other.id,
      email: "intruder@example.test",
      isPrimary: true
    })

    expect(await getClientDocumentRecipient(client.id)).toEqual({
      email: "billing@acme.test",
      name: "Acme Studio"
    })
  })

  test("resolves nothing for a soft-deleted client", async () => {
    await database.update(clients).set({ deletedAt: new Date() })

    expect(await getClientDocumentRecipient(client.id)).toBeNull()
  })
})

describe("listClientRecipientIdentities", () => {
  test("admits the client's own address and its live contacts only", async () => {
    const other = await makeClient({ email: "other@example.test" })

    await makeClientContact({ clientId: client.id, email: "finance@acme.test", isPrimary: true })
    await makeClientContact({
      clientId: client.id,
      email: "former@acme.test",
      deletedAt: new Date()
    })
    await makeClientContact({ clientId: other.id, email: "intruder@example.test" })

    const identities = await listClientRecipientIdentities(client.id)

    expect(identities.map((identity) => identity.email)).toEqual([
      "billing@acme.test",
      "finance@acme.test"
    ])
  })

  test("admits nothing for a soft-deleted client", async () => {
    await makeClientContact({ clientId: client.id, email: "finance@acme.test", isPrimary: true })

    await database.update(clients).set({ deletedAt: new Date() })

    expect(await listClientRecipientIdentities(client.id)).toEqual([])
  })
})
