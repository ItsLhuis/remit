import { getRateLimitConnection } from "./connection"
import { createInMemoryAdapter } from "./inMemoryAdapter"
import { createRedisAdapter } from "./redisAdapter"

export { createInMemoryAdapter } from "./inMemoryAdapter"
export { type RateLimitAdapter, type RateLimitResult } from "./types"

// Redis whenever it answers, and no variable to choose otherwise: `REDIS_URL` is boot-fatal in
// `lib/config/env.ts`, so no Remit instance runs without one, and a switch back to process-local
// counting would exist only to be left on by mistake. The in-memory adapter serves as the fallback
// while Redis is unreachable and as the test double. `proxy.ts` gets the same instance, because a
// Next.js 16 proxy always runs on the Node.js runtime and can load ioredis like any route handler.
export const rateLimitInstance = createRedisAdapter({
  getClient: getRateLimitConnection,
  fallback: createInMemoryAdapter()
})
