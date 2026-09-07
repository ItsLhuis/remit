import { logger } from "@/lib/logger"

import { registerJobHandler } from "@/lib/jobs"

import { runRetentionPurge } from "./purge"
import { getRetentionPolicy } from "./queries"

// The trash module's half of the scheduled work (ADR-0023). Handlers register at module load, the
// way `features/*/events.ts` register bus subscribers, and `scripts/worker.ts` is what imports this
// file — nothing under `lib/` reaches into a feature.
registerJobHandler("retention.purge.sweep", runRetentionPurgeSweep)

async function runRetentionPurgeSweep(): Promise<void> {
  const policy = await getRetentionPolicy()

  if (policy.trashDays === null && policy.financialDays === null) return

  const result = await runRetentionPurge(policy, new Date())

  if (result.totalRows === 0) return

  logger.info(
    {
      action: "retention.purge.sweep",
      totalRows: result.totalRows,
      entries: result.entries
    },
    "Retention purge removed expired records"
  )
}
