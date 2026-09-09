import { spawn, type ChildProcess } from "node:child_process"
import { connect } from "node:net"

import { loadAppContext } from "./appContext"

type JobQueue = {
  enqueueJob: typeof import("@/lib/jobs").enqueueJob
  // Synchronisation, never an assertion: proving a re-delivered sweep generated *nothing* needs a
  // point in time the absence is true at, and "the second sweep has finished" is that point. What
  // the spec then asserts is still only what the page shows.
  waitForJob: (jobId: string) => Promise<void>
  stop: () => Promise<void>
}

const PROBE_TIMEOUT_MS = 2_000
const POLL_INTERVAL_MS = 200
const WORKER_READY_TIMEOUT_MS = 60_000
const JOB_TIMEOUT_MS = 60_000

// Whether the Playwright process itself can reach the queue. It cannot in the e2e workflow, where
// `REDIS_URL` names the compose-internal `redis` host, so the caller turns a `false` here into a
// skip with a reason rather than into a failure or, worse, a green run that proved nothing.
export async function isJobQueueReachable(): Promise<boolean> {
  const { env } = await import("@/lib/config/env")
  const url = new URL(env.REDIS_URL)

  return await new Promise((resolve) => {
    // A raw TCP probe rather than an ioredis PING: `createRedisConnection` sets
    // `maxRetriesPerRequest: null` so BullMQ's blocking commands are never given up on, which means
    // a PING against an unreachable host never returns.
    const socket = connect({ host: url.hostname, port: Number(url.port || 6379) })

    const settle = (reachable: boolean) => {
      socket.destroy()
      resolve(reachable)
    }

    socket.setTimeout(PROBE_TIMEOUT_MS)
    socket.once("connect", () => settle(true))
    socket.once("timeout", () => settle(false))
    socket.once("error", () => settle(false))
  })
}

// The production consumer entrypoint, spawned as its own process. Stage 28 exists because a stubbed
// queue accepts every job id ever written, and two ids BullMQ refuses sat undetected through six
// stages; a spec that faked the consumer would repeat that. It is a child process rather than an
// in-process `startWorker()` because `features/dataExport/jobs.ts` imports `package.json`, and
// Playwright's ESM loader rejects a JSON import that carries no import attribute — loading a subset
// of the worker's modules to dodge that would recreate exactly the drift
// `loadWorkerFeatureModules` was extracted to prevent.
export async function startJobWorker(): Promise<JobQueue> {
  // Environment first: `@/lib/jobs` reaches `lib/config/env.ts`, which exits the process when a
  // variable is missing.
  await loadAppContext()

  const [{ enqueueJob }, { getQueue }] = await Promise.all([
    import("@/lib/jobs"),
    import("@/lib/jobs/queue")
  ])

  const child = spawn(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/worker.ts"], {
    cwd: process.cwd(),
    stdio: "ignore"
  })

  await waitUntil(
    async () => (await getQueue().getWorkers()).length > 0,
    WORKER_READY_TIMEOUT_MS,
    "The job worker did not connect to the queue within the timeout"
  )

  const waitForJob = async (jobId: string): Promise<void> => {
    await waitUntil(
      async () => Boolean((await getQueue().getJob(jobId))?.finishedOn),
      JOB_TIMEOUT_MS,
      `Job ${jobId} did not finish within the timeout`
    )
  }

  return { enqueueJob, waitForJob, stop: () => stopChild(child) }
}

async function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return

  await new Promise<void>((resolve) => {
    child.once("exit", () => resolve())
    child.kill("SIGTERM")
  })
}

async function waitUntil(
  isSettled: () => Promise<boolean>,
  timeoutMs: number,
  message: string
): Promise<void> {
  const deadline = Date.now() + timeoutMs

  for (;;) {
    if (await isSettled()) return

    if (Date.now() > deadline) throw new Error(message)

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }
}
