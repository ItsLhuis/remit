import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { summarizeLeads, type LeadSummaryRow } from "../summarizeLeads"

const NOW = new Date("2026-06-15T12:00:00.000Z")

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

test("returns an empty summary when there are no leads", () => {
  const summary = summarizeLeads([], NOW)

  expect(summary).toEqual({
    total: 0,
    open: 0,
    won: 0,
    lost: 0,
    converted: 0,
    newThisMonth: 0,
    acquisitionTrend: [
      { month: "2026-01", newLeads: 0, totalLeads: 0 },
      { month: "2026-02", newLeads: 0, totalLeads: 0 },
      { month: "2026-03", newLeads: 0, totalLeads: 0 },
      { month: "2026-04", newLeads: 0, totalLeads: 0 },
      { month: "2026-05", newLeads: 0, totalLeads: 0 },
      { month: "2026-06", newLeads: 0, totalLeads: 0 }
    ]
  })
})

test("counts open, won, lost, converted, and new-this-month leads", () => {
  const rows: LeadSummaryRow[] = [
    { status: "new", createdAt: new Date("2026-06-02T00:00:00.000Z"), convertedAt: null },
    { status: "qualified", createdAt: new Date("2026-05-20T00:00:00.000Z"), convertedAt: null },
    {
      status: "won",
      createdAt: new Date("2026-06-10T00:00:00.000Z"),
      convertedAt: new Date("2026-06-11T00:00:00.000Z")
    },
    { status: "lost", createdAt: new Date("2026-04-01T00:00:00.000Z"), convertedAt: null }
  ]

  const summary = summarizeLeads(rows, NOW)

  expect(summary).toEqual({
    total: 4,
    open: 2,
    won: 1,
    lost: 1,
    converted: 1,
    newThisMonth: 2,
    acquisitionTrend: [
      { month: "2026-01", newLeads: 0, totalLeads: 0 },
      { month: "2026-02", newLeads: 0, totalLeads: 0 },
      { month: "2026-03", newLeads: 0, totalLeads: 0 },
      { month: "2026-04", newLeads: 1, totalLeads: 1 },
      { month: "2026-05", newLeads: 1, totalLeads: 2 },
      { month: "2026-06", newLeads: 2, totalLeads: 4 }
    ]
  })
})

test("builds a six-month acquisition trend with cumulative totals", () => {
  const rows: LeadSummaryRow[] = [
    { status: "new", createdAt: new Date("2026-01-15T00:00:00.000Z"), convertedAt: null },
    { status: "new", createdAt: new Date("2026-05-10T00:00:00.000Z"), convertedAt: null },
    { status: "new", createdAt: new Date("2026-06-02T00:00:00.000Z"), convertedAt: null }
  ]

  const summary = summarizeLeads(rows, NOW)

  expect(summary.acquisitionTrend).toEqual([
    { month: "2026-01", newLeads: 1, totalLeads: 1 },
    { month: "2026-02", newLeads: 0, totalLeads: 1 },
    { month: "2026-03", newLeads: 0, totalLeads: 1 },
    { month: "2026-04", newLeads: 0, totalLeads: 1 },
    { month: "2026-05", newLeads: 1, totalLeads: 2 },
    { month: "2026-06", newLeads: 1, totalLeads: 3 }
  ])
})
