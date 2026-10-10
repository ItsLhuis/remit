import { getRateLimitConnection } from "./connection"
import { createInMemoryAdapter } from "./inMemoryAdapter"
import { createRedisAdapter } from "./redisAdapter"
import { type RateLimitAdapter } from "./types"

export { createInMemoryAdapter } from "./inMemoryAdapter"
export { countRateLimitTrip } from "./tripCounter"
export { type RateLimitAdapter, type RateLimitResult } from "./types"

const LIMITER_KEY: unique symbol = Symbol.for("remit.rateLimit.instance")

type LimiterHolder = { [LIMITER_KEY]?: RateLimitAdapter }

// Redis whenever it answers, and no variable to choose otherwise: `REDIS_URL` is boot-fatal in
// `lib/config/env.ts`, so no Remit instance runs without one, and a switch back to process-local
// counting would exist only to be left on by mistake. The in-memory adapter serves as the fallback
// while Redis is unreachable and as the test double.
//
// Held on `globalThis`, the way `lib/events/bus.ts` holds the event registry, because this module is
// not evaluated once per process. A Next.js 16 proxy always runs on the Node.js runtime, in the same
// process as the route handlers, but Turbopack compiles it as its own entry (`middleware.js`), and
// the SSR layer carries another copy again: a production build holds this module under separate
// module ids, and each evaluation would build its own adapter. Separate adapters meant one Redis
// outage logged once per copy and fallback counters that each admitted a full limit. One process, one
// limiter — one connection, one fallback store, one outage log.
export const rateLimitInstance: RateLimitAdapter = ((globalThis as LimiterHolder)[LIMITER_KEY] ??=
  createRedisAdapter({
    getClient: getRateLimitConnection,
    fallback: createInMemoryAdapter()
  }))
