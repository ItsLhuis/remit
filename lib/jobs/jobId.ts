// The id shapes that never reach Redis, rejected here rather than discovered in production.
// `queue.add` throws on a colon-bearing or integer id, and `enqueueJob` turns a throw into a log
// line so a queue outage cannot fail a user action — which means an id this function would reject
// enqueues nothing and reports success. That combination is what left reminder dispatch queuing
// nothing through six stages.
//
// An empty id is not BullMQ's rule but this module's: `enqueueJob` would drop a falsy id and enqueue
// under a generated one, losing the collapse-on-duplicate the caller asked for without saying so.
//
// The colon rule is stricter than BullMQ's own check on purpose. Upstream still accepts an id that
// splits into exactly three colon-delimited parts, a back-compat branch for repeatable jobs that its
// source marks for removal in the next breaking change. `recurring.invoice.generate:<id>:<date>` sat
// on exactly that exemption. An id that works only because it happens to carry two colons is a
// latent failure, so every colon is rejected.
export function assertValidJobId(jobId: string): void {
  if (jobId.length === 0) {
    throw new Error("Invalid job id: a custom id cannot be empty")
  }

  if (jobId.includes(":")) {
    throw new Error(`Invalid job id "${jobId}": a custom id cannot contain ":"`)
  }

  // An all-digit id collides with the counter BullMQ assigns to jobs added without one, so the two
  // id spaces are kept disjoint.
  if (String(Number.parseInt(jobId, 10)) === jobId) {
    throw new Error(`Invalid job id "${jobId}": a custom id cannot be an integer`)
  }
}
