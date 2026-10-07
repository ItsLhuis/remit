import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { buildBackupFilename, buildPreRestoreSnapshotPath } from "../filename"
import { type BackupPlan } from "../plan"
import { enforceLocalRetention } from "../writeArchive"

// A frozen clock, because the retention windows are measured back from "now" and an archive's age
// is read from the time in its name.
const NOW = new Date("2026-10-06T01:00:00.000Z")
const DAY_MS = 24 * 60 * 60 * 1000

let backupsDir: string

beforeEach(async () => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)

  backupsDir = await mkdtemp(path.join(os.tmpdir(), "remit-local-retention-"))
})

afterEach(async () => {
  vi.useRealTimers()

  await rm(backupsDir, { recursive: true, force: true })
})

async function writeArchiveAged(days: number): Promise<string> {
  const filename = buildBackupFilename(new Date(NOW.getTime() - days * DAY_MS), "1.0.0")

  await writeFile(path.join(backupsDir, filename), "archive")

  return filename
}

function planFor(filename: string, daily: number): BackupPlan {
  return {
    archiveFilename: filename,
    archiveUri: path.join(backupsDir, filename),
    destination: "local",
    objectKey: null,
    outputPath: path.join(backupsDir, filename),
    retentionPolicy: { daily, weekly: 0, monthly: 0 },
    tableNames: []
  }
}

test("keeps the archives the daily count covers and deletes the older ones", async () => {
  const oldest = await writeArchiveAged(2)
  const yesterday = await writeArchiveAged(1)
  const today = await writeArchiveAged(0)

  await enforceLocalRetention(planFor(today, 2))

  const remaining = await readdir(backupsDir)

  expect(remaining.sort()).toEqual([today, yesterday].sort())
  expect(remaining).not.toContain(oldest)
})

test("never deletes the archive this run just wrote, even when the policy keeps nothing", async () => {
  const yesterday = await writeArchiveAged(1)
  const today = await writeArchiveAged(0)

  await enforceLocalRetention(planFor(today, 0))

  const remaining = await readdir(backupsDir)

  expect(remaining).toEqual([today])
  expect(remaining).not.toContain(yesterday)
})

test("leaves snapshots and archives named by hand where they are", async () => {
  const snapshot = path.basename(
    buildPreRestoreSnapshotPath(backupsDir, new Date(NOW.getTime() - 30 * DAY_MS), "1.0.0")
  )
  await writeFile(path.join(backupsDir, snapshot), "snapshot")
  await writeFile(path.join(backupsDir, "before-migration.remitbak"), "by hand")
  const today = await writeArchiveAged(0)

  await enforceLocalRetention(planFor(today, 1))

  expect((await readdir(backupsDir)).sort()).toEqual(
    [snapshot, "before-migration.remitbak", today].sort()
  )
})
