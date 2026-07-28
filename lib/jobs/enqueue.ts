import { logger } from "@/lib/logger"

import { type JobMap, type JobName } from "./types"

// The producer half of ADR-0022 (PDF rendering) and ADR-0023 (BullMQ + Redis). The queue driver
// arrives with the scheduled-jobs work; this body is the only thing that changes when it does, so
// callers already sit behind the final typed contract. Rendering a PDF inline in a server action is
// what this exists to prevent, and a producer that cannot reach its queue must never fail the
// action that requested the job — hence a log rather than a throw.
export function enqueueJob<TName extends JobName>(
  name: TName,
  payload: JobMap[TName]
): Promise<void> {
  logger.info({ action: "enqueueJob", job: name, payload }, "Job enqueued")

  return Promise.resolve()
}
