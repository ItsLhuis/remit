import { describe, expect, test } from "vitest"

import {
  isWithinRange,
  isWithinWindow,
  resolveComparisonRange,
  resolveDashboardWindow,
  resolveEarliestWindowStart,
  startOfUtcMonth,
  startOfUtcYear
} from "../dashboardPeriod"

const NOW = new Date("2026-08-10T13:45:12.000Z")

describe("resolveDashboardWindow", () => {
  test("starts at the first instant of the current UTC month for the month period", () => {
    const window = resolveDashboardWindow("month", NOW)

    expect(window.start).toEqual(new Date("2026-08-01T00:00:00.000Z"))
  })

  test("starts at the first month of the current quarter for the quarter period", () => {
    const window = resolveDashboardWindow("quarter", NOW)

    expect(window.start).toEqual(new Date("2026-07-01T00:00:00.000Z"))
  })

  test("starts at the first month of the quarter when the month is already the first of it", () => {
    const window = resolveDashboardWindow("quarter", new Date("2026-10-01T00:00:00.000Z"))

    expect(window.start).toEqual(new Date("2026-10-01T00:00:00.000Z"))
  })

  test("starts at the first instant of the current UTC year for the year period", () => {
    const window = resolveDashboardWindow("year", NOW)

    expect(window.start).toEqual(new Date("2026-01-01T00:00:00.000Z"))
  })

  test("has no lower bound for the all-time period", () => {
    const window = resolveDashboardWindow("all", NOW)

    expect(window.start).toBeNull()
  })
})

describe("isWithinWindow", () => {
  test("includes a value stamped exactly at the window start", () => {
    const window = resolveDashboardWindow("month", NOW)

    expect(isWithinWindow(new Date("2026-08-01T00:00:00.000Z"), window)).toBe(true)
  })

  test("excludes a value one millisecond before the window start", () => {
    const window = resolveDashboardWindow("month", NOW)

    expect(isWithinWindow(new Date("2026-07-31T23:59:59.999Z"), window)).toBe(false)
  })

  test("includes every value when the window has no lower bound", () => {
    const window = resolveDashboardWindow("all", NOW)

    expect(isWithinWindow(new Date("2019-01-01T00:00:00.000Z"), window)).toBe(true)
  })
})

describe("resolveEarliestWindowStart", () => {
  test("returns the earliest bounded start when every window is bounded", () => {
    const earliest = resolveEarliestWindowStart([
      { start: startOfUtcMonth(NOW) },
      { start: startOfUtcYear(NOW) }
    ])

    expect(earliest).toEqual(new Date("2026-01-01T00:00:00.000Z"))
  })

  test("returns null when any window is unbounded", () => {
    const earliest = resolveEarliestWindowStart([{ start: startOfUtcMonth(NOW) }, { start: null }])

    expect(earliest).toBeNull()
  })

  test("returns null when no windows are provided", () => {
    expect(resolveEarliestWindowStart([])).toBeNull()
  })
})

describe("resolveComparisonRange", () => {
  test("has no predecessor for the all-time period", () => {
    expect(resolveComparisonRange("all", NOW)).toBeNull()
  })

  test("compares only the elapsed part of the previous month", () => {
    const range = resolveComparisonRange("month", NOW)

    expect(range?.start).toEqual(new Date("2026-07-01T00:00:00.000Z"))
    expect(range?.endExclusive).toEqual(new Date("2026-07-10T13:45:12.000Z"))
  })

  test("steps back a whole quarter rather than a fixed number of days", () => {
    expect(resolveComparisonRange("quarter", NOW)?.start).toEqual(
      new Date("2026-04-01T00:00:00.000Z")
    )
  })

  test("steps back to the first of the previous year", () => {
    expect(resolveComparisonRange("year", NOW)?.start).toEqual(new Date("2025-01-01T00:00:00.000Z"))
  })

  test("crosses the year boundary when the current month is January", () => {
    const range = resolveComparisonRange("month", new Date("2026-01-05T00:00:00.000Z"))

    expect(range?.start).toEqual(new Date("2025-12-01T00:00:00.000Z"))
  })
})

describe("isWithinRange", () => {
  const RANGE = {
    start: new Date("2026-07-01T00:00:00.000Z"),
    endExclusive: new Date("2026-08-01T00:00:00.000Z")
  }

  test("includes an instant exactly at the start", () => {
    expect(isWithinRange(new Date("2026-07-01T00:00:00.000Z"), RANGE)).toBe(true)
  })

  test("excludes an instant exactly at the end", () => {
    expect(isWithinRange(new Date("2026-08-01T00:00:00.000Z"), RANGE)).toBe(false)
  })
})
