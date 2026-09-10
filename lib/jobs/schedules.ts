import { logger } from "@/lib/logger"

import { getQueue } from "./queue"
import { type JobName } from "./types"

export type ScheduledJobName = Extract<JobName, `${string}.sweep`>

type RepeatableJob = {
  name: ScheduledJobName
  pattern: string
}

// Six-field cron (the leading field is seconds), pinned to UTC so a host time-zone change cannot
// move a run across a day boundary and skip or repeat an occurrence. The times are staggered rather
// than shared: generation runs first so an invoice created overnight is already visible to overdue
// detection, and reminders run at a civil hour because they send mail a client reads.
//
// The backup runs at 01:00, ahead of all of them, and the hour is a data-safety choice rather than a
// load one. `retention.purge.sweep` at 02:30 hard-deletes rows that nothing else can bring back, so
// an archive taken before it always still contains the last day it destroyed; taken afterwards, the
// most recent archive would be the first one missing them. The heaviest job of the night also sits
// clear of the money-affecting ones either side of 02:00.
//
// Every pattern here is fixed, including the backup's. A per-instance `backup_cadence` is honoured
// by `features/backups/jobs.ts` deciding whether tonight is a backup night, not by this pattern
// changing: a scheduler whose pattern tracked a settings column would have to be rewritten in Redis
// on every save, and `removeUnknownJobSchedulers` below only reconciles keys, not patterns.
const REPEATABLE_JOBS: RepeatableJob[] = [
  { name: "backup.run.sweep", pattern: "0 0 1 * * *" },
  { name: "recurring.schedule.sweep", pattern: "0 0 2 * * *" },
  { name: "invoice.overdue.sweep", pattern: "0 15 2 * * *" },
  { name: "invoice.reminder.sweep", pattern: "0 0 8 * * *" },
  { name: "retention.purge.sweep", pattern: "0 30 2 * * *" }
]

export const SCHEDULED_JOB_NAMES: ScheduledJobName[] = REPEATABLE_JOBS.map((job) => job.name)

export async function registerRepeatableJobs(): Promise<void> {
  const queue = getQueue()

  for (const job of REPEATABLE_JOBS) {
    await queue.upsertJobScheduler(
      job.name,
      { pattern: job.pattern, tz: "UTC" },
      { name: job.name }
    )
  }

  await removeUnknownJobSchedulers()

  logger.info(
    { action: "registerRepeatableJobs", jobs: REPEATABLE_JOBS.map((job) => job.name) },
    "Repeatable jobs registered"
  )
}

// A scheduler lives in Redis until something deletes it, so a job renamed or dropped in code keeps
// enqueuing under its old name forever — jobs the worker has no handler for, failing every retry.
// Reconciling on every boot is what keeps Redis agreeing with this file.
async function removeUnknownJobSchedulers(): Promise<void> {
  const known = new Set<string>(REPEATABLE_JOBS.map((job) => job.name))
  const existing = await getQueue().getJobSchedulers()

  for (const scheduler of existing) {
    if (known.has(scheduler.key)) continue

    await getQueue().removeJobScheduler(scheduler.key)

    logger.warn(
      { action: "registerRepeatableJobs", scheduler: scheduler.key },
      "Removed unknown job scheduler"
    )
  }
}
