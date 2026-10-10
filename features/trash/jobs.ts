import { logger } from "@/lib/logger"

import { registerJobHandler } from "@/lib/jobs"
import { drainObjectDeletions } from "@/lib/storage/objectDeletions"

import { expireDataExports } from "@/features/dataExport/systemWrites"

import { expireReportExports } from "@/features/reports/systemWrites"

import { runRetentionPurge } from "./purge"
import { getRetentionPolicy } from "./queries"

// The trash module's half of the scheduled work (ADR-0023). Handlers register at module load, the
// way `features/*/events.ts` register bus subscribers, and `scripts/worker.ts` is what imports this
// file — nothing under `lib/` reaches into a feature.
registerJobHandler("retention.purge.sweep", runRetentionPurgeSweep)
registerJobHandler("storage.deletion.sweep", runStorageDeletionSweep)

// Export artifacts expire on every run, ahead of the windows check: their lifetime is fixed rather
// than configured, so an instance with no retention window still stops keeping every archive forever.
async function runRetentionPurgeSweep(): Promise<void> {
  const now = new Date()

  const [expiredDataExports, expiredReportExports] = await Promise.all([
    expireDataExports(now),
    expireReportExports(now)
  ])

  if (expiredDataExports.rows + expiredReportExports.rows > 0) {
    logger.info(
      {
        action: "retention.purge.sweep",
        expiredDataExports: expiredDataExports.rows,
        expiredReportExports: expiredReportExports.rows
      },
      "Expired export artifacts removed"
    )
  }

  const policy = await getRetentionPolicy()

  if (policy.trashDays === null && policy.financialDays === null) return

  const result = await runRetentionPurge(policy, now)

  if (result.totalRows === 0) return

  logger.info(
    {
      action: "retention.purge.sweep",
      totalRows: result.totalRows,
      storageObjects: result.storageObjects,
      entries: result.entries
    },
    "Retention purge removed expired records"
  )
}

async function runStorageDeletionSweep(): Promise<void> {
  const result = await drainObjectDeletions()

  if (result.deleted > 0) {
    logger.info(
      { action: "storage.deletion.sweep", deleted: result.deleted, failed: result.failed },
      "Queued stored objects removed"
    )
  }
}
