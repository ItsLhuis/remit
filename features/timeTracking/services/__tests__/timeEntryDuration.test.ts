import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { computeDurationSeconds, toDurationParts } from "../timeEntryDuration"

describe("computeDurationSeconds", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-05T12:00:00.000Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test("returns the elapsed seconds between a timer start and stop", () => {
    const startedAt = new Date()

    vi.advanceTimersByTime(95 * 60 * 1000)

    const result = computeDurationSeconds(startedAt, new Date())

    expect(result).toBe(5700)
  })

  test("returns the elapsed seconds for a manual entry that crosses midnight", () => {
    const startedAt = new Date("2026-08-05T23:30:00.000Z")
    const endedAt = new Date("2026-08-06T00:45:00.000Z")

    const result = computeDurationSeconds(startedAt, endedAt)

    expect(result).toBe(4500)
  })

  // 2026-03-29 is the European spring-forward night: 01:00 UTC is 01:00 in Lisbon and 02:00 in
  // Lisbon at once, so the two instants below read as 00:30 and 02:30 on the wall clock. Wall-clock
  // arithmetic would call that two hours; elapsed time is one, which is what the freelancer worked.
  test("returns the true elapsed seconds across a spring-forward DST transition", () => {
    const startedAt = new Date("2026-03-29T00:30:00.000Z")
    const endedAt = new Date("2026-03-29T01:30:00.000Z")

    const result = computeDurationSeconds(startedAt, endedAt)

    expect(result).toBe(3600)
  })

  // The autumn transition repeats an hour of wall clock, so 01:30 local occurs twice and a
  // wall-clock subtraction would report zero for a genuine hour of work.
  test("returns the true elapsed seconds across an autumn-back DST transition", () => {
    const startedAt = new Date("2026-10-25T00:30:00.000Z")
    const endedAt = new Date("2026-10-25T01:30:00.000Z")

    const result = computeDurationSeconds(startedAt, endedAt)

    expect(result).toBe(3600)
  })

  test("truncates a sub-second remainder to whole seconds", () => {
    const startedAt = new Date("2026-08-05T09:00:00.000Z")
    const endedAt = new Date("2026-08-05T09:00:10.750Z")

    const result = computeDurationSeconds(startedAt, endedAt)

    expect(result).toBe(10)
  })

  test("returns zero when the entry starts and ends at the same instant", () => {
    const instant = new Date("2026-08-05T09:00:00.000Z")

    const result = computeDurationSeconds(instant, new Date(instant))

    expect(result).toBe(0)
  })

  test("returns null when the entry ends before it starts", () => {
    const startedAt = new Date("2026-08-05T10:00:00.000Z")
    const endedAt = new Date("2026-08-05T09:00:00.000Z")

    const result = computeDurationSeconds(startedAt, endedAt)

    expect(result).toBeNull()
  })

  test("returns null when either instant is not a real date", () => {
    const result = computeDurationSeconds(new Date("not a date"), new Date())

    expect(result).toBeNull()
  })
})

describe("toDurationParts", () => {
  test("splits a duration into whole hours, minutes and seconds", () => {
    const result = toDurationParts(9045)

    expect(result).toEqual({ hours: 2, minutes: 30, seconds: 45 })
  })

  test("reports zero for an empty duration", () => {
    const result = toDurationParts(0)

    expect(result).toEqual({ hours: 0, minutes: 0, seconds: 0 })
  })

  test("clamps a negative duration to zero", () => {
    const result = toDurationParts(-120)

    expect(result).toEqual({ hours: 0, minutes: 0, seconds: 0 })
  })
})
