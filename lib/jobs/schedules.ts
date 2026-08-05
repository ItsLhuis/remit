import { logger } from "@/lib/logger"

import { getQueue } from "./queue"
import { type JobName } from "./types"

type RepeatableJob = {
  name: Extract<JobName, `${string}.sweep`>
  pattern: string
}

// Six-field cron (the leading field is seconds), pinned to UTC so a host time-zone change cannot
// move a run across a day boundary and skip or repeat an occurrence. The times are staggered rather
// than shared: generation runs first so an invoice created overnight is already visible to overdue
// detection, and reminders run at a civil hour because they send mail a client reads.
const REPEATABLE_JOBS: RepeatableJob[] = [
  { name: "recurring.schedule.sweep", pattern: "0 0 2 * * *" },
  { name: "invoice.overdue.sweep", pattern: "0 15 2 * * *" },
  { name: "invoice.reminder.sweep", pattern: "0 0 8 * * *" }
]

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
