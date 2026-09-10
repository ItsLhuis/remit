import { chmod, mkdir, readdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"

import { eq } from "drizzle-orm"

import { afterAll, beforeAll, beforeEach, expect, test } from "vitest"

import { acquireBackupLock, releaseBackupLock } from "@/lib/backups/backupLock"
import { enqueueJob } from "@/lib/jobs"
import { getQueue } from "@/lib/jobs/queue"
import { startWorker, stopWorker } from "@/lib/jobs/worker"

import { auditLogs, settings } from "@/database/schema"

import { loadWorkerFeatureModules } from "@/scripts/core/worker/loadWorkerFeatureModules"
import { makeSettings } from "@/tests/factories"
import { client, database } from "@/tests/integration/database"

const BACKUPS_DIRECTORY = path.resolve(".tmp/integration-data", "backups")

const POLL_INTERVAL_MS = 100
const POLL_TIMEOUT_MS = 25_000

const originalPath = process.env.PATH

// Delegates to the Dockerized test Postgres the suite already requires, because `pg_dump` is not on
// a developer host and the archive is worthless without a real dump inside it. The same shim the
// backup command's own integration test uses.
async function writePgDumpShim(directory: string): Promise<void> {
  if (process.platform === "win32") {
    await writeFile(
      path.join(directory, "pg_dump.cmd"),
      [
        "@echo off",
        "docker compose -f docker-compose.test.yml exec -T -e PGPASSWORD=remit_test database_test pg_dump -U remit_test -d remit_test %*"
      ].join("\r\n")
    )

    return
  }

  const scriptPath = path.join(directory, "pg_dump")

  await writeFile(
    scriptPath,
    [
      "#!/usr/bin/env sh",
      'docker compose -f docker-compose.test.yml exec -T -e PGPASSWORD=remit_test database_test pg_dump -U remit_test -d remit_test "$@"'
    ].join("\n")
  )
  await chmod(scriptPath, 0o755)
}

async function listArchives(): Promise<string[]> {
  try {
    return (await readdir(BACKUPS_DIRECTORY)).filter((name) => name.endsWith(".remitbak"))
  } catch {
    return []
  }
}

async function readBackupStatus() {
  const [row] = await database
    .select({
      lastSuccessAt: settings.backupLastSuccessAt,
      lastFailureAt: settings.backupLastFailureAt,
      lastFailureReason: settings.backupLastFailureReason
    })
    .from(settings)

  return row ?? null
}

// Real timers throughout: the queue's own delay and lock arithmetic reads the clock, so a frozen one
// would stall the worker rather than the test.
async function waitFor<TValue>(
  read: () => Promise<TValue>,
  isSettled: (value: TValue) => boolean
): Promise<TValue> {
  const deadline = Date.now() + POLL_TIMEOUT_MS

  for (;;) {
    const value = await read()

    if (isSettled(value)) return value

    if (Date.now() > deadline) throw new Error("Timed out waiting for the queue to settle")

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }
}

// Proving an absence needs a moment the absence is true at, and "the sweep has finished" is it.
async function waitForJob(jobId: string): Promise<void> {
  await waitFor(
    async () => (await getQueue().getJob(jobId))?.finishedOn ?? null,
    (finishedOn) => finishedOn !== null
  )
}

beforeAll(async () => {
  const shimDirectory = path.resolve(".tmp/integration-data", "bin")

  await mkdir(shimDirectory, { recursive: true })
  await writePgDumpShim(shimDirectory)

  process.env.PATH = `${shimDirectory}${path.delimiter}${originalPath ?? ""}`

  await getQueue().obliterate({ force: true })

  await loadWorkerFeatureModules()
  await startWorker()
})

afterAll(async () => {
  await stopWorker()

  process.env.PATH = originalPath
})

beforeEach(async () => {
  await rm(BACKUPS_DIRECTORY, { force: true, recursive: true })
})

test("writes an archive and records success when the sweep runs through the queue", async () => {
  await makeSettings({ backupCadence: "daily", backupDestination: "local" })

  await enqueueJob("backup.run.sweep", {}, { jobId: "test.backup.sweep.first" })

  const status = await waitFor(readBackupStatus, (row) => row?.lastSuccessAt != null)

  expect(await listArchives()).toHaveLength(1)
  expect(status?.lastFailureAt).toBeNull()

  const [audit] = await database
    .select({ event: auditLogs.event, userAgent: auditLogs.userAgent })
    .from(auditLogs)
    .where(eq(auditLogs.event, "instance.backup.completed"))

  // The user agent is what separates a scheduled archive from an operator's `cli/backup` run in the
  // trail; without it the two are indistinguishable after the fact.
  expect(audit).toMatchObject({ userAgent: "worker/backup" })
})

test("writes no second archive when the sweep runs again inside the cadence", async () => {
  await makeSettings({ backupCadence: "daily", backupLastSuccessAt: new Date() })

  await enqueueJob("backup.run.sweep", {}, { jobId: "test.backup.sweep.recent" })
  await waitForJob("test.backup.sweep.recent")

  expect(await listArchives()).toEqual([])
})

test("writes no archive while another backup holds the lock", async () => {
  await makeSettings({ backupCadence: "daily", backupDestination: "local" })

  const lock = await acquireBackupLock(client)

  try {
    await enqueueJob("backup.run.sweep", {}, { jobId: "test.backup.sweep.locked" })
    await waitForJob("test.backup.sweep.locked")

    expect(await listArchives()).toEqual([])
    expect((await readBackupStatus())?.lastSuccessAt).toBeNull()
  } finally {
    await releaseBackupLock(lock)
  }
})

test("records a translated failure and no credential when the destination is misconfigured", async () => {
  await makeSettings({ backupCadence: "daily", backupDestination: "s3" })

  await enqueueJob("backup.run.sweep", {}, { jobId: "test.backup.sweep.failing" })

  const status = await waitFor(readBackupStatus, (row) => row?.lastFailureAt != null)

  expect(status?.lastSuccessAt).toBeNull()
  expect(status?.lastFailureReason).toContain("/settings/backup")

  const [audit] = await database
    .select({ metadata: auditLogs.metadata, userAgent: auditLogs.userAgent })
    .from(auditLogs)
    .where(eq(auditLogs.event, "instance.backup.failed"))

  expect(audit).toMatchObject({ userAgent: "worker/backup" })
  expect(JSON.stringify(audit?.metadata)).not.toContain("secretKey")
})
