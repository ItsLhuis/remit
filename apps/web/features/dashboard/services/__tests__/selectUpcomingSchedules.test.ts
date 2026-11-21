import { describe, expect, test } from "vitest"

import { selectUpcomingSchedules, type UpcomingScheduleRow } from "../selectUpcomingSchedules"

const NOW = new Date("2026-08-17T09:30:00.000Z")

function makeRow(overrides: Partial<UpcomingScheduleRow> = {}): UpcomingScheduleRow {
  return {
    id: "schedule-1",
    name: "Retainer",
    clientName: "Acme",
    cadence: "monthly",
    nextRunAt: new Date("2026-09-01T00:00:00.000Z"),
    ...overrides
  }
}

describe("selectUpcomingSchedules", () => {
  test("returns nothing when no schedule is active", () => {
    expect(selectUpcomingSchedules([], NOW)).toEqual([])
  })

  test("reports a run due today as zero days away", () => {
    const rows = [makeRow({ nextRunAt: new Date("2026-08-17T00:00:00.000Z") })]

    expect(selectUpcomingSchedules(rows, NOW)[0]?.daysUntilRun).toBe(0)
  })

  test("keeps a run whose date has already passed and reports it as negative", () => {
    const rows = [makeRow({ nextRunAt: new Date("2026-08-15T00:00:00.000Z") })]

    expect(selectUpcomingSchedules(rows, NOW)[0]?.daysUntilRun).toBe(-2)
  })

  test("drops a run beyond the window", () => {
    const rows = [makeRow({ nextRunAt: new Date("2026-12-01T00:00:00.000Z") })]

    expect(selectUpcomingSchedules(rows, NOW)).toEqual([])
  })

  test("orders the soonest run first", () => {
    const rows = [
      makeRow({ id: "later", nextRunAt: new Date("2026-09-20T00:00:00.000Z") }),
      makeRow({ id: "sooner", nextRunAt: new Date("2026-08-20T00:00:00.000Z") })
    ]

    expect(selectUpcomingSchedules(rows, NOW).map((row) => row.id)).toEqual(["sooner", "later"])
  })

  test("caps the list at the requested limit", () => {
    const rows = Array.from({ length: 8 }, (_, index) =>
      makeRow({ id: `schedule-${index}`, nextRunAt: new Date("2026-08-20T00:00:00.000Z") })
    )

    expect(selectUpcomingSchedules(rows, NOW, 60, 5)).toHaveLength(5)
  })
})
