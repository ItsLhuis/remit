import { expect, test } from "vitest"

import { computeRetentionDeletions, type BackupRetentionArchive } from "../backupRetention"

test("returns no deletions when there are no archives", () => {
  const result = computeRetentionDeletions([], { daily: 7, weekly: 4, monthly: 12 }, now())

  expect(result).toEqual([])
})

test("keeps the most recent archive per day in the daily tier", () => {
  const result = computeRetentionDeletions(
    [
      archive("today", "2026-05-21T11:00:00.000Z"),
      archive("yesterday-newer", "2026-05-20T11:00:00.000Z"),
      archive("yesterday-older", "2026-05-20T10:00:00.000Z"),
      archive("too-old", "2026-05-19T11:00:00.000Z")
    ],
    { daily: 2, weekly: 0, monthly: 0 },
    now()
  )

  expect(result).toEqual(["too-old", "yesterday-older"])
})

test("keeps daily, weekly, and monthly representatives without overlapping tiers", () => {
  const result = computeRetentionDeletions(
    [
      archive("daily", "2026-07-01T11:00:00.000Z"),
      archive("weekly-current", "2026-06-29T10:00:00.000Z"),
      archive("weekly-previous", "2026-06-22T10:00:00.000Z"),
      archive("weekly-over-limit", "2026-06-16T13:00:00.000Z"),
      archive("monthly-newer", "2026-06-10T10:00:00.000Z"),
      archive("monthly-older-same-month", "2026-06-05T10:00:00.000Z"),
      archive("monthly-over-limit", "2026-05-15T10:00:00.000Z")
    ],
    { daily: 1, weekly: 2, monthly: 1 },
    new Date("2026-07-01T12:00:00.000Z")
  )

  expect(result).toEqual(["monthly-over-limit", "monthly-older-same-month", "weekly-over-limit"])
})

test("uses ISO week years across calendar year boundaries", () => {
  const result = computeRetentionDeletions(
    [
      archive("week-one", "2027-01-04T10:00:00.000Z"),
      archive("week-fifty-three-newer", "2027-01-03T10:00:00.000Z"),
      archive("week-fifty-three-older", "2026-12-29T10:00:00.000Z"),
      archive("week-over-limit", "2026-12-20T10:00:00.000Z")
    ],
    { daily: 0, weekly: 2, monthly: 0 },
    new Date("2027-01-10T12:00:00.000Z")
  )

  expect(result).toEqual(["week-over-limit", "week-fifty-three-older"])
})

function archive(key: string, createdAt: string): BackupRetentionArchive {
  return { key, createdAt: new Date(createdAt), size: 1 }
}

function now(): Date {
  return new Date("2026-05-21T12:00:00.000Z")
}
