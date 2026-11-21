import { describe, expect, test } from "vitest"

import { createInMemoryTripCounter, decideTripAudit, parseTripReply } from "../tripWindow"

describe("trip audit decision", () => {
  test("writes an entry for the first refusal of a window", () => {
    expect(decideTripAudit([1, 0])).toEqual({ write: true, suppressedSincePreviousEntry: 0 })
  })

  test("only counts every later refusal in the same window", () => {
    expect(decideTripAudit([2, 0])).toEqual({ write: false })
    expect(decideTripAudit([500, 0])).toEqual({ write: false })
  })

  test("carries the previous window's suppressed count into the next entry", () => {
    expect(decideTripAudit([1, 41])).toEqual({ write: true, suppressedSincePreviousEntry: 41 })
  })

  test("treats a reply of any other shape as a store failure", () => {
    expect(() => parseTripReply(["1", 0])).toThrow()
  })
})

describe("in-memory trip counter", () => {
  test("writes once per window and reports what the last window suppressed", () => {
    let now = 0
    const counter = createInMemoryTripCounter(() => now)

    const flood = Array.from({ length: 50 }, () => decideTripAudit(counter.count("ip", 60_000)))

    now = 60_000

    const nextWindow = decideTripAudit(counter.count("ip", 60_000))

    expect(flood.filter((decision) => decision.write)).toHaveLength(1)
    expect(nextWindow).toEqual({ write: true, suppressedSincePreviousEntry: 49 })
  })

  test("keeps keys apart", () => {
    const counter = createInMemoryTripCounter(() => 0)

    counter.count("a", 60_000)

    expect(decideTripAudit(counter.count("b", 60_000)).write).toBe(true)
  })
})
