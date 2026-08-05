import { type JobMap, type JobName } from "./types"

export type JobHandler<TName extends JobName> = (payload: JobMap[TName]) => Promise<void>

const handlers = new Map<JobName, JobHandler<JobName>>()

// The consumer half of the typed catalog, deliberately shaped like `lib/events/bus.ts` — features
// own their handlers and register them at module load, and nothing under `lib/` imports a feature.
// Unlike the event bus a job name takes exactly one handler: two would each see the job once and
// silently halve the work, so a double registration is a boot-time programming error rather than a
// fan-out.
export function registerJobHandler<TName extends JobName>(
  name: TName,
  handler: JobHandler<TName>
): void {
  if (handlers.has(name)) throw new Error(`Job handler already registered for "${name}"`)

  handlers.set(name, handler as JobHandler<JobName>)
}

export function getJobHandler(name: JobName): JobHandler<JobName> | undefined {
  return handlers.get(name)
}

export function getRegisteredJobNames(): JobName[] {
  return [...handlers.keys()]
}
