import { describe, expect, test } from "vitest"

import { computeNextRunDate, toUtcDay } from "../computeNextRunDate"

const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

describe("weekly cadence", () => {
  test("advances to the next occurrence of the configured weekday", () => {
    const next = computeNextRunDate({
      cadence: "weekly",
      cadenceDay: 3,
      lastRunAt: utc("2026-08-03")
    })

    expect(next.toISOString()).toBe("2026-08-05T00:00:00.000Z")
  })

  test("advances a full week when the anchor already sits on the configured weekday", () => {
    const next = computeNextRunDate({
      cadence: "weekly",
      cadenceDay: 1,
      lastRunAt: utc("2026-08-03")
    })

    expect(next.toISOString()).toBe("2026-08-10T00:00:00.000Z")
  })

  test("treats seven as Sunday", () => {
    const next = computeNextRunDate({
      cadence: "weekly",
      cadenceDay: 7,
      lastRunAt: utc("2026-08-03")
    })

    expect(next.toISOString()).toBe("2026-08-09T00:00:00.000Z")
  })

  // `getUTCDay()` reports Sunday as 0 while the configured weekday is ISO, where Sunday is 7. An
  // anchor falling on a Sunday is the one input where the two numbering schemes disagree.
  test("advances correctly from an anchor that falls on a Sunday", () => {
    const next = computeNextRunDate({
      cadence: "weekly",
      cadenceDay: 2,
      lastRunAt: utc("2026-08-09")
    })

    expect(next.toISOString()).toBe("2026-08-11T00:00:00.000Z")
  })

  test("adds seven days when no weekday is configured", () => {
    const next = computeNextRunDate({
      cadence: "weekly",
      cadenceDay: null,
      lastRunAt: utc("2026-08-03")
    })

    expect(next.toISOString()).toBe("2026-08-10T00:00:00.000Z")
  })

  test("crosses a month boundary", () => {
    const next = computeNextRunDate({
      cadence: "weekly",
      cadenceDay: null,
      lastRunAt: utc("2026-08-28")
    })

    expect(next.toISOString()).toBe("2026-09-04T00:00:00.000Z")
  })
})

describe("monthly cadence", () => {
  test("keeps the configured day of month", () => {
    const next = computeNextRunDate({
      cadence: "monthly",
      cadenceDay: 15,
      lastRunAt: utc("2026-08-15")
    })

    expect(next.toISOString()).toBe("2026-09-15T00:00:00.000Z")
  })

  test("clamps a day past the end of a short month", () => {
    const next = computeNextRunDate({
      cadence: "monthly",
      cadenceDay: 31,
      lastRunAt: utc("2026-08-31")
    })

    expect(next.toISOString()).toBe("2026-09-30T00:00:00.000Z")
  })

  test("returns to the configured day after a clamped month rather than drifting", () => {
    const clamped = computeNextRunDate({
      cadence: "monthly",
      cadenceDay: 31,
      lastRunAt: utc("2026-08-31")
    })

    const afterClamp = computeNextRunDate({
      cadence: "monthly",
      cadenceDay: 31,
      lastRunAt: clamped
    })

    expect(afterClamp.toISOString()).toBe("2026-10-31T00:00:00.000Z")
  })

  test("clamps to 28 in a non-leap February", () => {
    const next = computeNextRunDate({
      cadence: "monthly",
      cadenceDay: 30,
      lastRunAt: utc("2026-01-30")
    })

    expect(next.toISOString()).toBe("2026-02-28T00:00:00.000Z")
  })

  test("clamps to 29 in a leap February", () => {
    const next = computeNextRunDate({
      cadence: "monthly",
      cadenceDay: 31,
      lastRunAt: utc("2028-01-31")
    })

    expect(next.toISOString()).toBe("2028-02-29T00:00:00.000Z")
  })

  test("crosses a year boundary", () => {
    const next = computeNextRunDate({
      cadence: "monthly",
      cadenceDay: 1,
      lastRunAt: utc("2026-12-01")
    })

    expect(next.toISOString()).toBe("2027-01-01T00:00:00.000Z")
  })

  test("keeps the anchor day when no day is configured", () => {
    const next = computeNextRunDate({
      cadence: "monthly",
      cadenceDay: null,
      lastRunAt: utc("2026-08-09")
    })

    expect(next.toISOString()).toBe("2026-09-09T00:00:00.000Z")
  })
})

describe("quarterly and yearly cadences", () => {
  test("adds three months for a quarterly schedule", () => {
    const next = computeNextRunDate({
      cadence: "quarterly",
      cadenceDay: 1,
      lastRunAt: utc("2026-08-01")
    })

    expect(next.toISOString()).toBe("2026-11-01T00:00:00.000Z")
  })

  test("crosses a year boundary for a quarterly schedule", () => {
    const next = computeNextRunDate({
      cadence: "quarterly",
      cadenceDay: 1,
      lastRunAt: utc("2026-11-01")
    })

    expect(next.toISOString()).toBe("2027-02-01T00:00:00.000Z")
  })

  test("adds twelve months for a yearly schedule", () => {
    const next = computeNextRunDate({
      cadence: "yearly",
      cadenceDay: 29,
      lastRunAt: utc("2028-02-29")
    })

    expect(next.toISOString()).toBe("2029-02-28T00:00:00.000Z")
  })
})

describe("time zone independence", () => {
  // The anchor below is 23:30 on 3 August in UTC but already 4 August in Lisbon summer time. Reading
  // the day through UTC getters is what keeps a schedule from landing a day early or late for any
  // instance away from Greenwich, since `next_run_at` is a date-only column.
  test("derives the day from UTC rather than the host time zone", () => {
    const next = computeNextRunDate({
      cadence: "monthly",
      cadenceDay: null,
      lastRunAt: new Date("2026-08-03T23:30:00.000Z")
    })

    expect(next.toISOString()).toBe("2026-09-03T00:00:00.000Z")
  })

  test("returns a midnight UTC value regardless of the time on the anchor", () => {
    const next = computeNextRunDate({
      cadence: "weekly",
      cadenceDay: null,
      lastRunAt: new Date("2026-08-03T17:45:12.345Z")
    })

    expect(next.getUTCHours()).toBe(0)
    expect(next.getUTCMinutes()).toBe(0)
    expect(next.getUTCMilliseconds()).toBe(0)
  })

  // A local-time implementation would produce 23:00 or 01:00 on the day the clocks move; UTC has no
  // such hour, so a schedule spanning a DST transition stays on its calendar day.
  test("is unaffected by a daylight saving transition", () => {
    const next = computeNextRunDate({
      cadence: "weekly",
      cadenceDay: null,
      lastRunAt: utc("2026-03-25")
    })

    expect(next.toISOString()).toBe("2026-04-01T00:00:00.000Z")
  })
})

test("toUtcDay strips the time from a value", () => {
  expect(toUtcDay(new Date("2026-08-03T22:10:00.000Z")).toISOString()).toBe(
    "2026-08-03T00:00:00.000Z"
  )
})
