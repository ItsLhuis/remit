import { logger } from "@/lib/logger"

import { assertValidJobId } from "./jobId"
import { getQueue } from "./queue"
import { type JobMap, type JobName } from "./types"

export type EnqueueJobOptions = {
  // A deterministic id makes a re-enqueue of the same unit of work collapse onto the job already
  // queued. It is a cheap first line, never the guard: BullMQ frees the id once the job completes
  // and is removed, so anything money-affecting still carries its own database-level check.
  jobId?: string
}

// The producer half of ADR-0022 (PDF rendering) and ADR-0023 (BullMQ + Redis). A producer that
// cannot reach its queue must never fail the action that requested the job — hence a log rather
// than a throw. The cost of that trade is explicit: an enqueue lost to a Redis outage is not
// retried, and the work is picked up by the next repeatable sweep rather than by this call.
//
// A malformed job id is the one failure that does not get that treatment, and the asymmetry is the
// point. A Redis outage is an environmental fact the caller cannot fix and must survive; a job id is
// a string this repository builds, so a rejected one is a programming error that is wrong on every
// run, in every environment. Swallowing it produces the worst possible outcome — a green action, an
// empty queue, and no signal anywhere — so it is validated before the transport and throws.
export async function enqueueJob<TName extends JobName>(
  name: TName,
  payload: JobMap[TName],
  options: EnqueueJobOptions = {}
): Promise<void> {
  if (options.jobId !== undefined) assertValidJobId(options.jobId)

  try {
    await getQueue().add(name, payload, options.jobId ? { jobId: options.jobId } : {})
  } catch (error) {
    logger.error({ action: "enqueueJob", job: name, payload, err: error }, "Job enqueue failed")
  }
}
