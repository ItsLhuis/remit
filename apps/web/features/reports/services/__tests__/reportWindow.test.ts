import { describe, expect, test } from "vitest"

import { resolveReportWindow, toUtcMonthKey } from "../reportWindow"

describe("resolveReportWindow", () => {
  test("leaves both bounds open when no range was picked", () => {
    expect(resolveReportWindow(null, null)).toEqual({ from: null, toExclusive: null })
  })

  test("widens the last day to the instant the next one begins so that day is included", () => {
    const window = resolveReportWindow(null, new Date("2026-03-31T00:00:00.000Z"))

    expect(window.toExclusive?.toISOString()).toBe("2026-04-01T00:00:00.000Z")
  })

  test("keeps the first day as the reader picked it", () => {
    const window = resolveReportWindow(new Date("2026-03-01T00:00:00.000Z"), null)

    expect(window.from?.toISOString()).toBe("2026-03-01T00:00:00.000Z")
  })
})

describe("toUtcMonthKey", () => {
  test("pads a single-digit month so keys sort chronologically as text", () => {
    expect(toUtcMonthKey(new Date("2026-03-09T00:00:00.000Z"))).toBe("2026-03")
  })

  test("reads the month in UTC rather than in the server's zone", () => {
    expect(toUtcMonthKey(new Date("2026-01-01T00:30:00.000Z"))).toBe("2026-01")
  })
})
