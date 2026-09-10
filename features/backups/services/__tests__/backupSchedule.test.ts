import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { evaluateBackupBannerState, isBackupDue } from "../backupSchedule"

const NOW = new Date("2026-09-09T01:00:00.000Z")

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

function agoMs(milliseconds: number): Date {
  return new Date(NOW.getTime() - milliseconds)
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe("isBackupDue", () => {
  test("is due when no backup has ever succeeded", () => {
    const due = isBackupDue({ cadence: "daily", lastSuccessAt: null, now: new Date() })

    expect(due).toBe(true)
  })

  test("is not due on a daily cadence when the last success is recent", () => {
    const due = isBackupDue({
      cadence: "daily",
      lastSuccessAt: agoMs(2 * HOUR_MS),
      now: new Date()
    })

    expect(due).toBe(false)
  })

  test("is due on a daily cadence once the run is within slack of a full day", () => {
    const due = isBackupDue({
      cadence: "daily",
      lastSuccessAt: agoMs(20 * HOUR_MS),
      now: new Date()
    })

    expect(due).toBe(true)
  })

  test("is not due on a daily cadence just inside the slack boundary", () => {
    const due = isBackupDue({
      cadence: "daily",
      lastSuccessAt: agoMs(20 * HOUR_MS - 1),
      now: new Date()
    })

    expect(due).toBe(false)
  })

  test("is not due on a weekly cadence two days after a success", () => {
    const due = isBackupDue({
      cadence: "weekly",
      lastSuccessAt: agoMs(2 * DAY_MS),
      now: new Date()
    })

    expect(due).toBe(false)
  })

  test("is due on a weekly cadence once the run is within slack of seven days", () => {
    const due = isBackupDue({
      cadence: "weekly",
      lastSuccessAt: agoMs(7 * DAY_MS - 4 * HOUR_MS),
      now: new Date()
    })

    expect(due).toBe(true)
  })

  test("is not due on a weekly cadence one moment before the slack boundary", () => {
    const due = isBackupDue({
      cadence: "weekly",
      lastSuccessAt: agoMs(7 * DAY_MS - 4 * HOUR_MS - 1),
      now: new Date()
    })

    expect(due).toBe(false)
  })
})

describe("evaluateBackupBannerState", () => {
  test("reports that no backup has ever run when neither outcome is recorded", () => {
    const state = evaluateBackupBannerState({
      cadence: "daily",
      lastFailureAt: null,
      lastSuccessAt: null,
      now: new Date()
    })

    expect(state).toBe("neverRun")
  })

  test("reports a failed run when the only recorded outcome is a failure", () => {
    const state = evaluateBackupBannerState({
      cadence: "daily",
      lastFailureAt: agoMs(HOUR_MS),
      lastSuccessAt: null,
      now: new Date()
    })

    expect(state).toBe("lastRunFailed")
  })

  test("reports a failed run when the failure is newer than the last success", () => {
    const state = evaluateBackupBannerState({
      cadence: "daily",
      lastFailureAt: agoMs(HOUR_MS),
      lastSuccessAt: agoMs(3 * HOUR_MS),
      now: new Date()
    })

    expect(state).toBe("lastRunFailed")
  })

  test("reports healthy when a success is newer than an earlier failure", () => {
    const state = evaluateBackupBannerState({
      cadence: "daily",
      lastFailureAt: agoMs(3 * HOUR_MS),
      lastSuccessAt: agoMs(HOUR_MS),
      now: new Date()
    })

    expect(state).toBe("healthy")
  })

  test("reports healthy on a daily cadence on the day after a success", () => {
    const state = evaluateBackupBannerState({
      cadence: "daily",
      lastFailureAt: null,
      lastSuccessAt: agoMs(DAY_MS + HOUR_MS),
      now: new Date()
    })

    expect(state).toBe("healthy")
  })

  test("reports overdue on a daily cadence after two missed nights", () => {
    const state = evaluateBackupBannerState({
      cadence: "daily",
      lastFailureAt: null,
      lastSuccessAt: agoMs(2 * DAY_MS + HOUR_MS),
      now: new Date()
    })

    expect(state).toBe("overdue")
  })

  test("reports healthy on a daily cadence exactly at the overdue boundary", () => {
    const state = evaluateBackupBannerState({
      cadence: "daily",
      lastFailureAt: null,
      lastSuccessAt: agoMs(2 * DAY_MS),
      now: new Date()
    })

    expect(state).toBe("healthy")
  })

  test("reports healthy on a weekly cadence two days after a success", () => {
    const state = evaluateBackupBannerState({
      cadence: "weekly",
      lastFailureAt: null,
      lastSuccessAt: agoMs(2 * DAY_MS),
      now: new Date()
    })

    expect(state).toBe("healthy")
  })

  test("reports overdue on a weekly cadence after eight days", () => {
    const state = evaluateBackupBannerState({
      cadence: "weekly",
      lastFailureAt: null,
      lastSuccessAt: agoMs(8 * DAY_MS + HOUR_MS),
      now: new Date()
    })

    expect(state).toBe("overdue")
  })

  test("reports healthy on a weekly cadence exactly at the overdue boundary", () => {
    const state = evaluateBackupBannerState({
      cadence: "weekly",
      lastFailureAt: null,
      lastSuccessAt: agoMs(8 * DAY_MS),
      now: new Date()
    })

    expect(state).toBe("healthy")
  })
})
