import { afterAll, beforeAll, expect, test } from "vitest"

import { readQueueJobCounts, readScheduledJobStats, registerJobHandler } from "@/lib/jobs"
import { createRedisConnection } from "@/lib/jobs/connection"
import { getQueue } from "@/lib/jobs/queue"
import { startWorker, stopWorker } from "@/lib/jobs/worker"

// The hash `lib/jobs/stats.ts` writes from the worker and reads from the app. Named here rather than
// imported because the name is a contract between two containers, and a rename that both sides
// agreed on would still orphan every count an existing instance had recorded.
const SCHEDULED_JOB_STATS_KEY = "remit:metrics:scheduled_jobs"

const POLL_INTERVAL_MS = 100
const POLL_TIMEOUT_MS = 20_000

const redis = createRedisConnection()

let succeedingRuns = 0
let failingRuns = 0

// Real timers and a real worker, like `queueRoundTrip.integration.test.ts`: the counts are written by
// the worker's own `completed` and `failed` events, and a stubbed queue would prove nothing about
// which of those events fire, or what `attemptsMade` holds when they do.
async function waitFor<TValue>(
  read: () => Promise<TValue>,
  isSettled: (value: TValue) => boolean
): Promise<TValue> {
  const deadline = Date.now() + POLL_TIMEOUT_MS

  for (;;) {
    const value = await read()

    if (isSettled(value)) return value

    if (Date.now() > deadline) throw new Error("Timed out waiting for the recorded outcome")

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }
}

async function readStatsFor(job: string) {
  const stats = await readScheduledJobStats()

  return stats.find((entry) => entry.job === job)
}

beforeAll(async () => {
  await getQueue().obliterate({ force: true })
  await redis.del(SCHEDULED_JOB_STATS_KEY)

  registerJobHandler("invoice.reminder.sweep", async () => {
    succeedingRuns += 1
  })
  registerJobHandler("invoice.overdue.sweep", async () => {
    failingRuns += 1

    throw new Error("Deliberate sweep failure")
  })
  registerJobHandler("proposal.pdf.render", async () => undefined)

  await startWorker()
})

afterAll(async () => {
  await stopWorker()
  await redis.quit()
})

test("records a completed scheduled run and its success time from the worker", async () => {
  const before = Math.floor(Date.now() / 1000)

  await getQueue().add("invoice.reminder.sweep", {}, { jobId: "test.stats.reminder.1" })

  const stats = await waitFor(
    () => readStatsFor("invoice.reminder.sweep"),
    (entry) => entry?.completed === 1
  )

  expect(succeedingRuns).toBe(1)
  expect(stats?.failed).toBe(0)
  expect(stats?.lastSuccessAt).toBeGreaterThanOrEqual(before)
})

test("counts a failed scheduled run once, after its last retry, and not per attempt", async () => {
  await getQueue().add(
    "invoice.overdue.sweep",
    {},
    { jobId: "test.stats.overdue.1", attempts: 2, backoff: { type: "fixed", delay: 50 } }
  )

  const stats = await waitFor(
    () => readStatsFor("invoice.overdue.sweep"),
    (entry) => entry?.failed === 1
  )

  expect(failingRuns).toBe(2)
  expect(stats?.completed).toBe(0)
  expect(stats?.lastSuccessAt).toBeNull()
  expect((await readQueueJobCounts()).failed).toBe(1)
})

test("records nothing for a job that is not a scheduled sweep", async () => {
  await getQueue().add("proposal.pdf.render", { proposalId: "p" }, { jobId: "test.stats.pdf.1" })

  await waitFor(
    async () => (await getQueue().getJob("test.stats.pdf.1"))?.finishedOn ?? null,
    (finishedOn) => finishedOn !== null
  )

  const fields = await redis.hkeys(SCHEDULED_JOB_STATS_KEY)

  expect(fields.some((field) => field.startsWith("proposal."))).toBe(false)
})
