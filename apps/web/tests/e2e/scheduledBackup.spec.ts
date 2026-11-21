import { randomUUID } from "node:crypto"

import { expect, test } from "@playwright/test"

import {
  countScheduledBackups,
  isPgDumpAvailable,
  listBackupArchives,
  removeBackupArchives,
  restoreBackupSettings,
  setBackupState,
  snapshotLocalBackupSettings
} from "./support/backupFixture"
import { isJobQueueReachable, startJobWorker } from "./support/jobWorker"
import { addOwnerSessionCookie } from "./support/ownerSession"
import { openRoute } from "./support/pageReadiness"

const TWO_NIGHTS_MS = 2 * 24 * 60 * 60 * 1000

let snapshot: Awaited<ReturnType<typeof snapshotLocalBackupSettings>> = null
let archivesBefore: string[] = []

test.beforeAll(async () => {
  snapshot = await snapshotLocalBackupSettings()
  archivesBefore = (await listBackupArchives()).map((archive) => archive.name)
})

test.afterAll(async () => {
  if (!snapshot) return

  const created = (await listBackupArchives()).filter(
    (archive) => !archivesBefore.includes(archive.name)
  )

  await removeBackupArchives(created)
  await restoreBackupSettings(snapshot)
})

// The nightly backup as the schedule runs it: `backup.run.sweep` enqueued through the real
// `enqueueJob` and consumed by the production worker process, on a night the configured cadence says
// is due. Only the moment is moved, by dating the last success two nights back rather than by faking
// a clock BullMQ's own lock and delay arithmetic would also read.
test("takes one archive on a backup night and nothing more when the sweep is delivered again", async ({
  page,
  baseURL
}) => {
  if (!baseURL) throw new Error("Playwright baseURL is required for this flow")

  test.skip(
    !(await isJobQueueReachable()),
    "This flow drives a real queue and a real worker, so it needs Redis reachable from the test process."
  )
  test.skip(
    !snapshot,
    "This flow rewrites the backup configuration, so it runs only on an instance that backs up to local disk."
  )
  test.skip(
    !isPgDumpAvailable(),
    "A backup runs pg_dump, which is not on this host's PATH; the e2e workflow installs the PostgreSQL client."
  )

  if (!snapshot) throw new Error("unreachable: skipped above")

  await setBackupState(snapshot, {
    backupCadence: "daily",
    backupLastSuccessAt: new Date(Date.now() - TWO_NIGHTS_MS)
  })

  const scheduledBefore = await countScheduledBackups()

  await addOwnerSessionCookie(page.context(), baseURL)

  await openRoute(page, "/settings/backup", "Backups")

  const lastSuccess = page.getByText(/^Last successful backup /)
  const lastSuccessBefore = await lastSuccess.innerText()

  const queue = await startJobWorker()

  try {
    const firstDeliveryId = `e2e.backup.sweep.${randomUUID()}`

    await queue.enqueueJob("backup.run.sweep", {}, { jobId: firstDeliveryId })
    await queue.waitForJob(firstDeliveryId)

    await page.reload()

    await expect(lastSuccess).not.toHaveText(lastSuccessBefore)

    const lastSuccessRecorded = await lastSuccess.innerText()
    const archivesAfterFirst = (await listBackupArchives()).filter(
      (archive) => !archivesBefore.includes(archive.name)
    )

    expect(archivesAfterFirst).toHaveLength(1)
    expect(await countScheduledBackups()).toBe(scheduledBefore + 1)

    // A fresh job id for the same night, which is what a second delivery looks like once BullMQ has
    // freed the first: the guard it meets is the cadence check against the success just recorded.
    const secondDeliveryId = `e2e.backup.sweep.${randomUUID()}`

    await queue.enqueueJob("backup.run.sweep", {}, { jobId: secondDeliveryId })
    await queue.waitForJob(secondDeliveryId)

    await page.reload()

    await expect(lastSuccess).toHaveText(lastSuccessRecorded)

    const archivesAfterSecond = (await listBackupArchives()).filter(
      (archive) => !archivesBefore.includes(archive.name)
    )

    expect(archivesAfterSecond).toEqual(archivesAfterFirst)
    expect(await countScheduledBackups()).toBe(scheduledBefore + 1)
  } finally {
    await queue.stop()
  }
})
