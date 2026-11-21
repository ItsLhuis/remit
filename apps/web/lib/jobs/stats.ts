import { logger } from "@/lib/logger"

import { createRedisConnection } from "./connection"
import { getQueue } from "./queue"
import { SCHEDULED_JOB_NAMES, type ScheduledJobName } from "./schedules"

// The queue states `/api/metrics` reports. `completed` is absent on purpose: `DEFAULT_JOB_OPTIONS`
// prunes completed jobs by age and count, so their number measures retention rather than work.
export const QUEUE_COUNT_STATES = [
  "waiting",
  "active",
  "delayed",
  "prioritized",
  "waiting-children",
  "failed"
] as const

export type QueueCountState = (typeof QUEUE_COUNT_STATES)[number]

export type ScheduledJobStats = {
  job: ScheduledJobName
  completed: number
  failed: number
  lastSuccessAt: number | null
}

type ScheduledJobOutcome = "completed" | "failed"

// One hash for every scheduled job, written by the worker and read by the app. Job metrics have to
// travel through Redis because the two run in different containers: the app answers the scrape and
// the worker runs the jobs, and an in-process counter in either would be invisible to the other.
const SCHEDULED_JOB_STATS_KEY = "remit:metrics:scheduled_jobs"

let statsConnection: ReturnType<typeof createRedisConnection> | null = null

export async function readQueueJobCounts(): Promise<Record<QueueCountState, number>> {
  const counts = await getQueue().getJobCounts(...QUEUE_COUNT_STATES)

  return Object.fromEntries(
    QUEUE_COUNT_STATES.map((state) => [state, counts[state] ?? 0])
  ) as Record<QueueCountState, number>
}

// Read back only through `SCHEDULED_JOB_NAMES`, never by iterating the hash. Whatever else the key
// holds — a field left by a job since renamed, or anything written by hand — cannot reach a label,
// so the `job` label stays a closed vocabulary however the stored data drifts.
export async function readScheduledJobStats(): Promise<ScheduledJobStats[]> {
  const fields = await getStatsConnection().hgetall(SCHEDULED_JOB_STATS_KEY)

  return SCHEDULED_JOB_NAMES.map((job) => ({
    job,
    completed: toCount(fields[`${job}:completed`]),
    failed: toCount(fields[`${job}:failed`]),
    lastSuccessAt: toTimestamp(fields[`${job}:last_success`])
  }))
}

// Records only the repeatable sweeps. Every other job is one per invoice, proposal or email, so a
// per-name run count would publish the instance's business volume; a sweep runs on a fixed clock
// whatever the business does, which is what makes its count operational rather than commercial.
//
// Called without an await from the worker's event handlers, and it never throws: a Redis hiccup
// while recording must not be able to fail the job it is recording.
export async function recordScheduledJobOutcome(
  name: string,
  outcome: ScheduledJobOutcome,
  finishedAtMs: number
): Promise<void> {
  if (!isScheduledJobName(name)) return

  try {
    const transaction = getStatsConnection()
      .multi()
      .hincrby(SCHEDULED_JOB_STATS_KEY, `${name}:${outcome}`, 1)

    if (outcome === "completed") {
      transaction.hset(
        SCHEDULED_JOB_STATS_KEY,
        `${name}:last_success`,
        Math.floor(finishedAtMs / 1000)
      )
    }

    await transaction.exec()
  } catch (error) {
    logger.warn(
      { action: "recordScheduledJobOutcome", job: name, outcome, err: error },
      "Scheduled job outcome not recorded"
    )
  }
}

export async function closeStatsConnection(): Promise<void> {
  if (!statsConnection) return

  const closing = statsConnection

  statsConnection = null

  await closing.quit()
}

// Lazy for the reason `getQueue` is: importing this module must not open a socket during a build.
function getStatsConnection(): ReturnType<typeof createRedisConnection> {
  statsConnection ??= createRedisConnection()

  return statsConnection
}

function isScheduledJobName(name: string): name is ScheduledJobName {
  return SCHEDULED_JOB_NAMES.some((scheduledName) => scheduledName === name)
}

function toCount(value: string | undefined): number {
  const count = Number(value ?? 0)

  return Number.isSafeInteger(count) && count >= 0 ? count : 0
}

function toTimestamp(value: string | undefined): number | null {
  if (value === undefined) return null

  const seconds = Number(value)

  return Number.isSafeInteger(seconds) && seconds > 0 ? seconds : null
}
