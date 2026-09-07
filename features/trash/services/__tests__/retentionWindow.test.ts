import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { getPurgeCutoff, getPurgeDueAt, isPurgeable } from "../retentionWindow"

const NOW = new Date("2026-06-01T12:00:00.000Z")
const DELETED_AT = new Date("2026-05-01T12:00:00.000Z")

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe("purge dates", () => {
  test("returns no purge date when the governing window is unset", () => {
    const dueAt = getPurgeDueAt(DELETED_AT, { trashDays: null, financialDays: 90 }, "trash")

    expect(dueAt).toBeNull()
  })

  test("dates the purge from the deletion when the window is set", () => {
    const dueAt = getPurgeDueAt(DELETED_AT, { trashDays: 30, financialDays: 90 }, "trash")

    expect(dueAt).toEqual(new Date("2026-05-31T12:00:00.000Z"))
  })

  test("uses the financial window for financial records", () => {
    const dueAt = getPurgeDueAt(DELETED_AT, { trashDays: 30, financialDays: 90 }, "financial")

    expect(dueAt).toEqual(new Date("2026-07-30T12:00:00.000Z"))
  })
})

describe("purge eligibility", () => {
  test("keeps a record forever when no window is configured", () => {
    const purgeable = isPurgeable(
      DELETED_AT,
      { trashDays: null, financialDays: null },
      "trash",
      NOW
    )

    expect(purgeable).toBe(false)
  })

  test("keeps a record one day inside the window", () => {
    const deletedAt = new Date("2026-05-03T12:00:00.000Z")

    const purgeable = isPurgeable(deletedAt, { trashDays: 30, financialDays: 90 }, "trash", NOW)

    expect(purgeable).toBe(false)
  })

  test("removes a record one day outside the window", () => {
    const deletedAt = new Date("2026-05-01T12:00:00.000Z")

    const purgeable = isPurgeable(deletedAt, { trashDays: 30, financialDays: 90 }, "trash", NOW)

    expect(purgeable).toBe(true)
  })

  test("keeps a financial record the general window would already have removed", () => {
    const deletedAt = new Date("2026-04-01T12:00:00.000Z")

    const purgeable = isPurgeable(
      deletedAt,
      { trashDays: 30, financialDays: 3650 },
      "financial",
      NOW
    )

    expect(purgeable).toBe(false)
  })
})

test("returns no cutoff when the window is unset", () => {
  expect(getPurgeCutoff({ trashDays: null, financialDays: null }, "financial", NOW)).toBeNull()
})

test("places the cutoff one window behind now", () => {
  const cutoff = getPurgeCutoff({ trashDays: 30, financialDays: 90 }, "trash", NOW)

  expect(cutoff).toEqual(new Date("2026-05-02T12:00:00.000Z"))
})
