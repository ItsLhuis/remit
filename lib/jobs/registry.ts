import { type JobMap, type JobName } from "./types"

export type JobHandler<TName extends JobName> = (payload: JobMap[TName]) => Promise<void>

export type JobHandlerOptions<TName extends JobName> = {
  // Called once BullMQ has given up on the job: after the attempt that exhausts its budget fails,
  // however it failed. For a job that records its own outcome inside each attempt, this is the one
  // place that can still record one when an attempt failed before it got that far — a database blip,
  // a crash mid-attempt — and the job would otherwise end with its record still saying "in
  // progress". `lib/jobs/worker.ts` calls it and logs, never rethrows, what it throws.
  onExhausted?: JobHandler<TName>
}

type Registration = {
  handler: JobHandler<JobName>
  onExhausted: JobHandler<JobName> | null
}

const registrations = new Map<JobName, Registration>()

// The consumer half of the typed catalog, deliberately shaped like `lib/events/bus.ts` — features
// own their handlers and register them at module load, and nothing under `lib/` imports a feature.
// Unlike the event bus a job name takes exactly one handler: two would each see the job once and
// silently halve the work, so a double registration is a boot-time programming error rather than a
// fan-out.
export function registerJobHandler<TName extends JobName>(
  name: TName,
  handler: JobHandler<TName>,
  options: JobHandlerOptions<TName> = {}
): void {
  if (registrations.has(name)) throw new Error(`Job handler already registered for "${name}"`)

  registrations.set(name, {
    handler: handler as JobHandler<JobName>,
    onExhausted: (options.onExhausted ?? null) as JobHandler<JobName> | null
  })
}

export function getJobHandler(name: JobName): JobHandler<JobName> | undefined {
  return registrations.get(name)?.handler
}

export function getJobExhaustedHandler(name: JobName): JobHandler<JobName> | null {
  return registrations.get(name)?.onExhausted ?? null
}

export function getRegisteredJobNames(): JobName[] {
  return [...registrations.keys()]
}
