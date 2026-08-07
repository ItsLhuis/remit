import { describe, expect, test } from "vitest"

import { makeActivityLog, makeSettings } from "@/tests/factories"

import {
  getActivityFeedPageData,
  getUnreadActivityCount,
  listActivity,
  listEntityActivity
} from "../queries"
import { parseActivityListQuery } from "../schemas"

describe("getUnreadActivityCount", () => {
  test("counts only the entries that have not been read", async () => {
    await makeActivityLog()
    await makeActivityLog()
    await makeActivityLog({ readAt: new Date() })

    expect(await getUnreadActivityCount()).toBe(2)
  })
})

describe("listActivity", () => {
  test("returns the newest entries first", async () => {
    await makeActivityLog({ createdAt: new Date("2026-01-01T00:00:00.000Z") })
    const newest = await makeActivityLog({ createdAt: new Date("2026-06-01T00:00:00.000Z") })

    const result = await listActivity(parseActivityListQuery({}))

    expect(result.rows[0]?.id).toBe(newest.id)
  })

  test("pages the result set while reporting the full row count", async () => {
    await Promise.all(Array.from({ length: 3 }, () => makeActivityLog()))

    const result = await listActivity(parseActivityListQuery({ perPage: "2", page: "2" }))

    expect(result.rows).toHaveLength(1)
    expect(result.rowCount).toBe(3)
  })

  test("narrows to a single entity type when the filter is set", async () => {
    await makeActivityLog({ entityType: "client" })
    await makeActivityLog({
      entityType: "invoice",
      messageKey: "activity.messages.invoicePaid",
      messageArgs: { number: "INV-1" }
    })

    const result = await listActivity(parseActivityListQuery({ type: "invoice" }))

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]?.entityType).toBe("invoice")
  })

  test("narrows to unread entries when the read filter is set", async () => {
    await makeActivityLog()
    await makeActivityLog({ readAt: new Date() })

    const result = await listActivity(parseActivityListQuery({ read: "unread" }))

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]?.unread).toBe(true)
  })

  test("drops an entry whose message key is no longer a translation", async () => {
    await makeActivityLog({ messageKey: "activity.messages.retiredMessage" })

    const result = await listActivity(parseActivityListQuery({}))

    expect(result.rows).toHaveLength(0)
  })
})

describe("listEntityActivity", () => {
  test("returns only the entries filed against that record", async () => {
    const entityId = crypto.randomUUID()

    await makeActivityLog({ entityType: "client", entityId })
    await makeActivityLog({ entityType: "client" })

    const entries = await listEntityActivity({ entityType: "client", entityId })

    expect(entries).toHaveLength(1)
    expect(entries[0]?.entityId).toBe(entityId)
  })

  test("returns nothing when the entity reference is not a uuid", async () => {
    expect(await listEntityActivity({ entityType: "client", entityId: "nope" })).toEqual([])
  })
})

describe("getActivityFeedPageData", () => {
  test("reports the page count and the instance locale alongside the entries", async () => {
    await makeSettings({ defaultLocale: "pt", defaultTimezone: "Europe/Lisbon" })
    await Promise.all(Array.from({ length: 3 }, () => makeActivityLog()))

    const data = await getActivityFeedPageData({ perPage: "2" })

    expect(data.pageCount).toBe(2)
    expect(data.unreadCount).toBe(3)
    expect(data.locale).toBe("pt")
    expect(data.timeZone).toBe("Europe/Lisbon")
  })
})
