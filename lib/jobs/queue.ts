import { Queue, type JobsOptions } from "bullmq"

import { createRedisConnection } from "./connection"

export const QUEUE_NAME = "remit"

// Retries are what makes a job durable rather than merely asynchronous (ADR-0023). Five attempts
// with exponential backoff covers a Redis blip, a database failover and a mail provider outage; a
// money-affecting job that survives none of those is a genuine failure worth a dead job to inspect.
// Every such job is idempotent at the database level, so a retry after a partial run is safe.
export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: { type: "exponential", delay: 5_000 },
  removeOnComplete: { age: 60 * 60 * 24, count: 1_000 },
  removeOnFail: { age: 60 * 60 * 24 * 7 }
}

let queue: Queue | null = null

// Lazy rather than module-level: importing this module must not open a Redis socket, because the
// Next.js server graph reaches it through `enqueueJob` and would otherwise connect during a build.
export function getQueue(): Queue {
  queue ??= new Queue(QUEUE_NAME, {
    connection: createRedisConnection(),
    defaultJobOptions: DEFAULT_JOB_OPTIONS
  })

  return queue
}

export async function closeQueue(): Promise<void> {
  if (!queue) return

  const closing = queue

  queue = null

  await closing.close()
}
