import { Worker, type Job } from "bullmq"

import { logger } from "@/lib/logger"

import { reportError } from "@/lib/errorTracking"

import { createRedisConnection } from "./connection"
import { closeQueue, QUEUE_NAME } from "./queue"
import { getJobHandler, getRegisteredJobNames } from "./registry"
import { registerRepeatableJobs } from "./schedules"
import { closeStatsConnection, recordScheduledJobOutcome } from "./stats"
import { type JobName } from "./types"

// One at a time. The money-affecting handlers take row locks on the same schedules and invoices, and
// a higher concurrency would buy nothing but lock contention on an instance that serves one
// freelancer (ADR-0002). Raise this only alongside a measured need.
const WORKER_CONCURRENCY = 1

let worker: Worker | null = null

// Deliberately not re-exported from `lib/jobs/index.ts`: that barrel is imported by server actions
// for `enqueueJob`, and re-exporting the consumer half would drag BullMQ's blocking connections into
// the Next.js server graph. The only caller is `scripts/worker.ts`.
export async function startWorker(): Promise<void> {
  if (worker) throw new Error("Worker already started")

  await registerRepeatableJobs()

  worker = new Worker(QUEUE_NAME, processJob, {
    connection: createRedisConnection(),
    concurrency: WORKER_CONCURRENCY
  })

  worker.on("failed", (job, error) => {
    const errorEventId = job ? settleFailedAttempt(job, error) : null

    logger.error(
      {
        action: "worker.job",
        job: job?.name,
        jobId: job?.id,
        attempt: job?.attemptsMade,
        errorEventId: errorEventId ?? undefined,
        err: error
      },
      "Job failed"
    )
  })

  worker.on("completed", (job) => {
    void recordScheduledJobOutcome(job.name, "completed", job.finishedOn ?? Date.now())
  })

  logger.info({ action: "worker.start", handlers: getRegisteredJobNames() }, "Job worker started")
}

export async function stopWorker(): Promise<void> {
  // `worker.close()` waits for in-flight jobs rather than interrupting them, which is what makes a
  // deploy safe: a half-written generation would otherwise leave the schedule advanced with no
  // invoice behind it. The queue closes second so a handler mid-run can still enqueue its follow-up.
  if (worker) {
    const closing = worker

    worker = null

    await closing.close()
  }

  await closeQueue()
  await closeStatsConnection()

  logger.info({ action: "worker.stop" }, "Job worker stopped")
}

// `failed` fires on every attempt, retries included, and `attemptsMade` already counts this one
// when it does. Only the attempt that exhausts the budget is a failed run, so only it is counted and
// reported; an attempt that a later retry recovers is neither. Returns the reported event's id.
function settleFailedAttempt(job: Job, error: Error): string | null {
  if (job.attemptsMade < (job.opts.attempts ?? 1)) return null

  void recordScheduledJobOutcome(job.name, "failed", Date.now())

  // The job's id stays out of the report: several are deterministic and embed the record they work
  // on. The caller's log line carries it beside the event id instead.
  return reportError(error, { source: "job", jobName: job.name, attempts: job.attemptsMade })
}

async function processJob(job: Job): Promise<void> {
  const handler = getJobHandler(job.name as JobName)

  // Throwing rather than ignoring: an unhandled name means the producer and the worker disagree
  // about what this deployment can do, and a silent success would hide dropped money-affecting work
  // behind a green queue.
  if (!handler) throw new Error(`No handler registered for job "${job.name}"`)

  await handler(job.data)
}
