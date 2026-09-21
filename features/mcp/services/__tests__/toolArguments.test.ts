import { describe, expect, test } from "vitest"

import { toDayRange, toFlagFilter, toIdFilter } from "../toolArguments"

describe("tool arguments", () => {
  test("reads calendar days as UTC midnights for a date column, both ends inclusive", () => {
    const range = toDayRange("2026-03-01", "2026-03-31", "date")

    expect(range).toEqual({
      from: new Date("2026-03-01T00:00:00.000Z"),
      to: new Date("2026-03-31T00:00:00.000Z")
    })
  })

  test("ends a range over instants at the last millisecond of its final day", () => {
    const range = toDayRange("2026-03-01", "2026-03-31", "instant")

    expect(range?.to).toEqual(new Date("2026-03-31T23:59:59.999Z"))
  })

  test("leaves a missing bound open", () => {
    const openStart = toDayRange(undefined, "2026-03-31", "date")
    const openEnd = toDayRange("2026-03-01", undefined, "instant")

    expect(openStart).toEqual({ from: null, to: new Date("2026-03-31T00:00:00.000Z") })
    expect(openEnd).toEqual({ from: new Date("2026-03-01T00:00:00.000Z"), to: null })
  })

  test("returns no range when neither day is given", () => {
    expect(toDayRange(undefined, undefined, "instant")).toBeUndefined()
  })

  test("maps a yes-or-no argument onto the screen's one-value filter", () => {
    expect(toFlagFilter(true, "invoiced", "unbilled")).toEqual(["invoiced"])
    expect(toFlagFilter(false, "invoiced", "unbilled")).toEqual(["unbilled"])
  })

  test("applies no filter when the yes-or-no argument is absent", () => {
    expect(toFlagFilter(undefined, "billable", "nonBillable")).toBeUndefined()
  })

  test("wraps a single id and passes an absent one through", () => {
    expect(toIdFilter("6f7a8b9c-0d1e-4f2a-8b3c-4d5e6f7a8b9c")).toEqual([
      "6f7a8b9c-0d1e-4f2a-8b3c-4d5e6f7a8b9c"
    ])
    expect(toIdFilter(undefined)).toBeUndefined()
  })
})
