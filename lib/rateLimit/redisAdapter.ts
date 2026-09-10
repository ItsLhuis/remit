import { logger } from "@/lib/logger"

import { type RateLimitAdapter, type RateLimitResult } from "./types"
import { parseWindowReply, toRateLimitKey, toRateLimitResult } from "./window"

type RateLimitStore = {
  eval(script: string, numberOfKeys: number, key: string, windowMs: number): Promise<unknown>
}

type RedisAdapterOptions = {
  getClient: () => RateLimitStore | Promise<RateLimitStore>
  fallback: RateLimitAdapter
}

// A fixed window, counted in one script because Redis runs a script atomically. Issued as separate
// commands, two requests can both read the counter below the limit before either writes, and an
// `INCR` whose `PEXPIRE` never lands leaves a key that never expires and blocks that caller for good.
// The expiry is set only by the request that opens the window, so later requests never extend it,
// and the remaining TTL comes back in the same round trip for `resetAt`.
//
// Sent with Redis `EVAL` on each call rather than registered through `defineCommand`: registering
// would need an `interface` augmentation of ioredis's command types to call it, for a script whose
// bytes cost nothing next to the round trip. The script is this constant and nothing else; the
// caller's key, which carries a client IP, travels only as `KEYS[1]` and is never spliced into it.
const CONSUME_WINDOW_SCRIPT = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
return { count, redis.call("PTTL", KEYS[1]) }
`

// While Redis is unreachable every call site counts in `fallback` instead — per process and lost on
// restart, which is exactly what the limiter was before a shared store existed. Neither alternative
// survives a look at the call sites: failing open would switch off the OTP and signing limits at the
// moment the instance is already degraded, and failing closed would turn a Redis blip into refused
// Stripe webhooks and unreachable public documents. ADR-0037 records the per-site reasoning.
//
// The outage is logged when it starts and when it ends, not per request: a flood of identical error
// lines is how a real one gets missed.
export function createRedisAdapter({ getClient, fallback }: RedisAdapterOptions): RateLimitAdapter {
  let isDegraded = false

  return {
    async consume(key: string, max: number, windowMs: number): Promise<RateLimitResult> {
      try {
        const client = await getClient()
        const reply = await client.eval(CONSUME_WINDOW_SCRIPT, 1, toRateLimitKey(key), windowMs)
        const result = toRateLimitResult(parseWindowReply(reply), max, Date.now())

        if (isDegraded) {
          isDegraded = false

          logger.info({ action: "rateLimit.consume" }, "Rate limiter store recovered")
        }

        return result
      } catch (error) {
        if (!isDegraded) {
          isDegraded = true

          logger.error(
            { action: "rateLimit.consume", err: error },
            "Rate limiter store unavailable, counting per process until it returns"
          )
        }

        return fallback.consume(key, max, windowMs)
      }
    }
  }
}
