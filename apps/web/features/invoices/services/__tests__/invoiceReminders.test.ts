import { describe, expect, test } from "vitest"

import { getReminderWindowDays, resolveDueReminder } from "../invoiceReminders"

const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

const schedule = { beforeDueDays: [3, 0], afterDueDays: [7, 14, 30] }

describe("before the due date", () => {
  test("returns the matching before-offset", () => {
    expect(resolveDueReminder(utc("2026-08-10"), schedule, utc("2026-08-07"))).toEqual({
      offsetDays: 3,
      phase: "before"
    })
  })

  test("treats zero as the due day itself", () => {
    expect(resolveDueReminder(utc("2026-08-10"), schedule, utc("2026-08-10"))).toEqual({
      offsetDays: 0,
      phase: "before"
    })
  })

  test("returns nothing on a day that is not configured", () => {
    expect(resolveDueReminder(utc("2026-08-10"), schedule, utc("2026-08-08"))).toBeNull()
  })
})

describe("after the due date", () => {
  test("returns the matching after-offset", () => {
    expect(resolveDueReminder(utc("2026-08-10"), schedule, utc("2026-08-24"))).toEqual({
      offsetDays: 14,
      phase: "after"
    })
  })

  test("returns nothing on a day that is not configured", () => {
    expect(resolveDueReminder(utc("2026-08-10"), schedule, utc("2026-08-20"))).toBeNull()
  })

  // An offset present in both arrays must not send the polite pre-due note to someone already late.
  test("prefers the after-phase when the same offset appears in both arrays", () => {
    const both = { beforeDueDays: [7], afterDueDays: [7] }

    expect(resolveDueReminder(utc("2026-08-10"), both, utc("2026-08-17"))).toEqual({
      offsetDays: 7,
      phase: "after"
    })
  })
})

describe("malformed settings", () => {
  test("returns nothing when both arrays are empty", () => {
    expect(
      resolveDueReminder(
        utc("2026-08-10"),
        { beforeDueDays: [], afterDueDays: [] },
        utc("2026-08-10")
      )
    ).toBeNull()
  })

  test("ignores a negative before-offset rather than reading it as an after-offset", () => {
    const malformed = { beforeDueDays: [-7], afterDueDays: [] }

    expect(resolveDueReminder(utc("2026-08-10"), malformed, utc("2026-08-17"))).toBeNull()
  })

  test("tolerates duplicates", () => {
    const duplicated = { beforeDueDays: [3, 3, 3], afterDueDays: [] }

    expect(resolveDueReminder(utc("2026-08-10"), duplicated, utc("2026-08-07"))).toEqual({
      offsetDays: 3,
      phase: "before"
    })
  })
})

describe("time zone independence", () => {
  test("derives the day difference from UTC rather than the host clock", () => {
    const lateInTheDay = new Date("2026-08-07T23:45:00.000Z")

    expect(resolveDueReminder(utc("2026-08-10"), schedule, lateInTheDay)).toEqual({
      offsetDays: 3,
      phase: "before"
    })
  })
})

describe("getReminderWindowDays", () => {
  test("returns the widest configured offset", () => {
    expect(getReminderWindowDays(schedule)).toBe(30)
  })

  test("returns null when nothing is configured", () => {
    expect(getReminderWindowDays({ beforeDueDays: [], afterDueDays: [] })).toBeNull()
  })

  test("ignores negative offsets when sizing the window", () => {
    expect(getReminderWindowDays({ beforeDueDays: [-5], afterDueDays: [2] })).toBe(2)
  })
})
