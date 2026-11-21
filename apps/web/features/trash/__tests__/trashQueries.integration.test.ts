import { eq } from "drizzle-orm"

import { describe, expect, test } from "vitest"

import { clients, leads, settings } from "@/database/schema"

import {
  makeClient,
  makeContract,
  makeContractSignature,
  makeInvoice,
  makeSettings
} from "@/tests/factories"
import { database } from "@/tests/integration/database"

import { getTrashSectionData } from "../queries"

const OLD = new Date("2026-04-22T12:00:00.000Z")

async function setWindows(trashDays: number, financialDays: number): Promise<void> {
  await makeSettings()
  await database.update(settings).set({
    retentionTrashDays: trashDays,
    retentionFinancialDays: financialDays
  })
}

describe("the trash", () => {
  test("pages past what used to be its 200-row ceiling", async () => {
    await database.insert(leads).values(
      Array.from({ length: 205 }, (_, index) => ({
        firstName: "Lead",
        lastName: String(index),
        email: `lead-${index}@example.com`,
        deletedAt: new Date(Date.UTC(2026, 0, 1, 0, index))
      }))
    )

    const lastPage = await getTrashSectionData({ trash_page: "3", trash_perPage: "100" })

    expect(lastPage.rowCount).toBe(205)
    expect(lastPage.items).toHaveLength(5)
    expect(lastPage.items[0]?.title).toBe("Lead 4")
  })

  test("dates a client by the documents that hold it, as the purge does", async () => {
    await setWindows(30, 90)
    const client = await makeClient({ deletedAt: OLD })
    await makeInvoice({ clientId: client.id, deletedAt: OLD })

    const { items } = await getTrashSectionData({})
    const row = items.find((item) => item.id === client.id)

    expect(row?.purge).toEqual({
      status: "scheduled",
      dueAt: new Date("2026-07-21T12:00:00.000Z"),
      heldByDocuments: true
    })
  })

  test("says a countersigned contract is never removed, and why", async () => {
    await setWindows(30, 30)
    const contract = await makeContract({ deletedAt: OLD })
    await makeContractSignature({ contractId: contract.id })

    const { items } = await getTrashSectionData({})
    const row = items.find((item) => item.id === contract.id)

    expect(row?.purge).toEqual({ status: "never", reason: "countersigned" })
  })

  test("says a client is kept while a live document still names it", async () => {
    await setWindows(30, 30)
    const client = await makeClient({ deletedAt: OLD })
    await makeInvoice({ clientId: client.id })

    const { items } = await getTrashSectionData({})

    expect(items.find((item) => item.id === client.id)?.purge).toEqual({
      status: "heldByLiveDocuments",
      documentCount: 1
    })
  })

  test("narrows to one record when a feed link names it", async () => {
    const wanted = await makeClient({ deletedAt: OLD })
    await makeClient({ deletedAt: OLD })

    const data = await getTrashSectionData({ trash_kind: "client", trash_record: wanted.id })

    expect(data.isNarrowedToRecord).toBe(true)
    expect(data.items.map((item) => item.id)).toEqual([wanted.id])
    expect(await database.select().from(clients).where(eq(clients.deletedAt, OLD))).toHaveLength(2)
  })
})
