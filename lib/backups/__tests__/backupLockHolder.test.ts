import { expect, test } from "vitest"

import {
  describeBackupLockHolder,
  formatBackupLockLabel,
  parseBackupLockLabel
} from "../backupLockHolder"

const SINCE = new Date("2026-10-06T19:41:00.000Z")

test("reads back the holder and start time of a label it wrote", () => {
  const label = formatBackupLockLabel("key-rotation", SINCE)

  const info = parseBackupLockLabel(label)

  expect(info).toEqual({ holder: "key-rotation", since: SINCE })
})

test("fits inside the 63 bytes Postgres keeps of an application name", () => {
  const label = formatBackupLockLabel("scheduled-backup", SINCE)

  expect(Buffer.byteLength(label)).toBeLessThanOrEqual(63)
})

test.each([
  [null],
  ["postgres.js"],
  ["remit-backup-lock:unknown-holder:2026-10-06T19:41:00.000Z"],
  ["remit-backup-lock:restore:not-a-date"],
  ["remit-backup-lock:restore"]
])("names no holder for a label this build did not write: %s", (label) => {
  expect(parseBackupLockLabel(label)).toBeNull()
})

test("names the operation and when it started", () => {
  const description = describeBackupLockHolder({ holder: "restore", since: SINCE })

  expect(description).toBe(
    "a restore run with pnpm remit:restore (running since 2026-10-06T19:41:00.000Z)"
  )
})

test("falls back to every operation the lock guards when the holder is unknown", () => {
  expect(describeBackupLockHolder(null)).toBe("another backup, restore or key rotation")
})
