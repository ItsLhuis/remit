import { describe, expect, test } from "vitest"

import { aggregateTimeByProject, type TimeReportRow } from "../aggregateTimeByProject"

const LABELS = { billable: "Billable", nonBillable: "Non-billable" }

function makeRow(overrides: Partial<TimeReportRow> = {}): TimeReportRow {
  return {
    projectId: "project-a",
    projectLabel: "Client A — Project A",
    billable: true,
    currency: "EUR",
    durationSeconds: 3600,
    amountCents: 10_000,
    ...overrides
  }
}

describe("aggregateTimeByProject", () => {
  test("returns nothing when no completed entry falls in the window", () => {
    expect(aggregateTimeByProject([], LABELS).groups).toEqual([])
  })

  test("keeps the billable and non-billable hours of one project as separate rows", () => {
    const result = aggregateTimeByProject(
      [makeRow(), makeRow({ billable: false, durationSeconds: 1800, amountCents: 5_000 })],
      LABELS
    )

    expect(result.groups[0]?.rows).toHaveLength(2)
    expect(result.groups[0]?.rows.map((row) => row.sublabel)).toEqual(
      expect.arrayContaining(["Billable", "Non-billable"])
    )
  })

  test("sums the entries of one billable state into one row", () => {
    const result = aggregateTimeByProject([makeRow(), makeRow({ durationSeconds: 5400 })], LABELS)

    expect(result.groups[0]?.rows[0]?.cells).toEqual([
      { kind: "count", value: 2 },
      { kind: "duration", seconds: 9000 },
      { kind: "money", cents: 20_000 }
    ])
  })

  test("separates projects priced in different currencies", () => {
    const result = aggregateTimeByProject(
      [makeRow(), makeRow({ projectId: "project-b", currency: "GBP" })],
      LABELS
    )

    expect(result.groups.map((group) => group.currency).toSorted()).toEqual(["EUR", "GBP"])
  })
})
