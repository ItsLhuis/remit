import { describe, expect, test } from "vitest"

import { toListSearchParams } from "../listSearchParams"

const paging = { page: 2, perPage: 50 }

describe("list search params", () => {
  test("carries paging alone when no filter is given", () => {
    const searchParams = toListSearchParams(paging)

    expect(Object.fromEntries(searchParams)).toEqual({ page: "2", perPage: "50" })
  })

  test("joins a multi-value filter with commas and drops empty values", () => {
    const searchParams = toListSearchParams(paging, {
      status: ["overdue", "partially_paid"],
      client: [],
      search: ""
    })

    expect(searchParams.get("status")).toBe("overdue,partially_paid")
    expect(searchParams.has("client")).toBe(false)
    expect(searchParams.has("search")).toBe(false)
  })

  test("passes a single value through and leaves an absent filter out", () => {
    const searchParams = toListSearchParams(paging, { search: "Acme", client: undefined })

    expect(searchParams.get("search")).toBe("Acme")
    expect(searchParams.has("client")).toBe(false)
  })

  test("writes a closed date range as its two bounds in epoch milliseconds", () => {
    const searchParams = toListSearchParams(paging, {
      issueDate: {
        from: new Date("2026-03-01T00:00:00.000Z"),
        to: new Date("2026-03-31T00:00:00.000Z")
      }
    })

    expect(searchParams.get("issueDate")).toBe(`${Date.UTC(2026, 2, 1)},${Date.UTC(2026, 2, 31)}`)
  })

  test("writes an open start as the epoch so the end keeps its position", () => {
    const searchParams = toListSearchParams(paging, {
      dueDate: { from: null, to: new Date("2026-03-31T00:00:00.000Z") }
    })

    expect(searchParams.get("dueDate")).toBe(`0,${Date.UTC(2026, 2, 31)}`)
  })

  test("writes an open end as the start alone", () => {
    const searchParams = toListSearchParams(paging, {
      spentAt: { from: new Date("2026-03-01T00:00:00.000Z"), to: null }
    })

    expect(searchParams.get("spentAt")).toBe(String(Date.UTC(2026, 2, 1)))
  })

  test("leaves out a range with neither bound", () => {
    const searchParams = toListSearchParams(paging, { started: { from: null, to: null } })

    expect(searchParams.has("started")).toBe(false)
  })
})
