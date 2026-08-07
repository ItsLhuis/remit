import { describe, expect, test } from "vitest"

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/lib/utils"

import { activityIdsSchema, activityMessageArgsSchema, parseActivityListQuery } from "../schemas"

describe("parseActivityListQuery", () => {
  test("falls back to an unfiltered first page when no parameters are given", () => {
    const query = parseActivityListQuery({})

    expect(query).toEqual({
      entityType: null,
      read: "all",
      page: 1,
      perPage: DEFAULT_PAGE_SIZE
    })
  })

  test("reads the entity type and read filter from the search parameters", () => {
    const query = parseActivityListQuery({ type: "invoice", read: "unread", page: "3" })

    expect(query.entityType).toBe("invoice")
    expect(query.read).toBe("unread")
    expect(query.page).toBe(3)
  })

  test("drops an entity type that is not part of the enum", () => {
    const query = parseActivityListQuery({ type: "lead" })

    expect(query.entityType).toBeNull()
  })

  test("clamps a page size above the maximum back to the default", () => {
    const query = parseActivityListQuery({ perPage: String(MAX_PAGE_SIZE + 1) })

    expect(query.perPage).toBe(DEFAULT_PAGE_SIZE)
  })
})

describe("activityIdsSchema", () => {
  test("rejects an empty selection", () => {
    expect(activityIdsSchema.safeParse({ ids: [] }).success).toBe(false)
  })

  test("rejects a selection larger than one page", () => {
    const ids = Array.from({ length: MAX_PAGE_SIZE + 1 }, () => crypto.randomUUID())

    expect(activityIdsSchema.safeParse({ ids }).success).toBe(false)
  })
})

describe("activityMessageArgsSchema", () => {
  test("accepts the scalar shapes ICU can format", () => {
    const parsed = activityMessageArgsSchema.safeParse({ number: "INV-1", days: 3, paid: true })

    expect(parsed.success).toBe(true)
  })

  test("rejects a nested value that would render as an object", () => {
    const parsed = activityMessageArgsSchema.safeParse({ client: { name: "Acme" } })

    expect(parsed.success).toBe(false)
  })
})
