import { redactOperationalError } from "../cli/redact"

import { type QueueDrainOutcome } from "./types"

// Runs after the database transaction commits, so it cannot join it. A failure is reported and
// never rethrown: the reset has already happened by then, and a queue that could not be reached is
// not a reason to tell the operator their data is still there. Orphaned jobs fail or no-op on their
// next run against rows that no longer exist.
export async function drainQueuedJobs(): Promise<QueueDrainOutcome> {
  const { closeQueue, getQueue } = await import("@/lib/jobs/queue")

  try {
    await getQueue().obliterate({ force: true })

    return { status: "drained" }
  } catch (error) {
    return {
      status: "failed",
      reason: redactOperationalError(error, { stripStackFrames: true })
    }
  } finally {
    await closeQueue().catch(() => undefined)
  }
}
