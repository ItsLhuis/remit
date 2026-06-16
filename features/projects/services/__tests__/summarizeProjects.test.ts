import { describe, expect, test } from "vitest"

import { summarizeProjects, type ProjectSummaryRow } from "../summarizeProjects"

const NOW = new Date("2026-06-15T00:00:00.000Z")

function makeRow(overrides: Partial<ProjectSummaryRow>): ProjectSummaryRow {
  return { status: "active", createdAt: NOW, ...overrides }
}

describe("summarizeProjects", () => {
  test("counts projects by status", () => {
    const rows = [
      makeRow({ status: "active" }),
      makeRow({ status: "on_hold" }),
      makeRow({ status: "completed" }),
      makeRow({ status: "cancelled" }),
      makeRow({ status: "active" })
    ]

    const result = summarizeProjects(rows, NOW)

    expect(result).toEqual({
      total: 5,
      active: 2,
      onHold: 1,
      completed: 1,
      cancelled: 1,
      newThisMonth: 5,
      acquisitionTrend: [
        { month: "2026-01", newProjects: 0, totalProjects: 0 },
        { month: "2026-02", newProjects: 0, totalProjects: 0 },
        { month: "2026-03", newProjects: 0, totalProjects: 0 },
        { month: "2026-04", newProjects: 0, totalProjects: 0 },
        { month: "2026-05", newProjects: 0, totalProjects: 0 },
        { month: "2026-06", newProjects: 5, totalProjects: 5 }
      ]
    })
  })

  test("counts only projects created in the current month as new", () => {
    const rows = [
      makeRow({ createdAt: new Date("2026-06-02T00:00:00.000Z") }),
      makeRow({ createdAt: new Date("2026-05-30T00:00:00.000Z") })
    ]

    const result = summarizeProjects(rows, NOW)

    expect(result.newThisMonth).toBe(1)
  })

  test("returns an all-zero summary for an empty list", () => {
    const result = summarizeProjects([], NOW)

    expect(result).toEqual({
      total: 0,
      active: 0,
      onHold: 0,
      completed: 0,
      cancelled: 0,
      newThisMonth: 0,
      acquisitionTrend: [
        { month: "2026-01", newProjects: 0, totalProjects: 0 },
        { month: "2026-02", newProjects: 0, totalProjects: 0 },
        { month: "2026-03", newProjects: 0, totalProjects: 0 },
        { month: "2026-04", newProjects: 0, totalProjects: 0 },
        { month: "2026-05", newProjects: 0, totalProjects: 0 },
        { month: "2026-06", newProjects: 0, totalProjects: 0 }
      ]
    })
  })

  test("builds a six-month acquisition trend with cumulative totals", () => {
    const rows = [
      makeRow({ createdAt: new Date("2026-01-15T00:00:00.000Z") }),
      makeRow({ createdAt: new Date("2026-05-10T00:00:00.000Z") }),
      makeRow({ createdAt: new Date("2026-06-02T00:00:00.000Z") })
    ]

    const result = summarizeProjects(rows, NOW)

    expect(result.acquisitionTrend).toEqual([
      { month: "2026-01", newProjects: 1, totalProjects: 1 },
      { month: "2026-02", newProjects: 0, totalProjects: 1 },
      { month: "2026-03", newProjects: 0, totalProjects: 1 },
      { month: "2026-04", newProjects: 0, totalProjects: 1 },
      { month: "2026-05", newProjects: 1, totalProjects: 2 },
      { month: "2026-06", newProjects: 1, totalProjects: 3 }
    ])
  })
})
