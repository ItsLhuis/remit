import { describe, expect, test } from "vitest"

import {
  summarizeUnbilledWork,
  type UnbilledExpenseRow,
  type UnbilledTimeRow
} from "../summarizeUnbilledWork"

function makeTime(overrides: Partial<UnbilledTimeRow> = {}): UnbilledTimeRow {
  return { currency: "EUR", durationSeconds: 3600, hourlyRateSnapshotCents: 8000, ...overrides }
}

function makeExpense(overrides: Partial<UnbilledExpenseRow> = {}): UnbilledExpenseRow {
  return { currency: "EUR", amountCents: 5000, markupPercentage: null, ...overrides }
}

describe("summarizeUnbilledWork", () => {
  test("reports zero across the board for an instance with nothing unbilled", () => {
    const work = summarizeUnbilledWork([], [], "EUR")

    expect(work.totalCents).toBe(0)
    expect(work.timeEntryCount).toBe(0)
    expect(work.expenseCount).toBe(0)
  })

  test("values time at the rate frozen onto the entry", () => {
    const work = summarizeUnbilledWork([makeTime({ hourlyRateSnapshotCents: 8000 })], [], "EUR")

    expect(work.timeCents).toBe(8000)
  })

  test("rounds each entry to whole cents before summing them", () => {
    const rows = [
      makeTime({ durationSeconds: 100, hourlyRateSnapshotCents: 8000 }),
      makeTime({ durationSeconds: 100, hourlyRateSnapshotCents: 8000 })
    ]

    expect(summarizeUnbilledWork(rows, [], "EUR").timeCents).toBe(444)
  })

  test("values an entry logged at a rate of zero at nothing without dropping it", () => {
    const work = summarizeUnbilledWork([makeTime({ hourlyRateSnapshotCents: 0 })], [], "EUR")

    expect(work.timeCents).toBe(0)
    expect(work.timeEntryCount).toBe(1)
  })

  test("ignores a running timer that has recorded no duration", () => {
    const work = summarizeUnbilledWork([makeTime({ durationSeconds: 0 })], [], "EUR")

    expect(work.timeEntryCount).toBe(0)
  })

  test("applies the markup to a rebillable expense", () => {
    const work = summarizeUnbilledWork([], [makeExpense({ markupPercentage: 15 })], "EUR")

    expect(work.expenseCents).toBe(5750)
  })

  test("bills an expense with no markup at cost", () => {
    expect(summarizeUnbilledWork([], [makeExpense()], "EUR").expenseCents).toBe(5000)
  })

  test("adds time and expenses into one claimable total", () => {
    const work = summarizeUnbilledWork([makeTime()], [makeExpense()], "EUR")

    expect(work.totalCents).toBe(13_000)
  })

  test("ignores work recorded in another currency", () => {
    const work = summarizeUnbilledWork(
      [makeTime(), makeTime({ currency: "USD" })],
      [makeExpense({ currency: "USD" })],
      "EUR"
    )

    expect(work.timeEntryCount).toBe(1)
    expect(work.expenseCount).toBe(0)
  })
})
