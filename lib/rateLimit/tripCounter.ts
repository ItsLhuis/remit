import { getRateLimitConnection } from "./connection"
import {
  createInMemoryTripCounter,
  decideTripAudit,
  parseTripReply,
  toTripKeys,
  TRIP_CARRY_TTL_MS,
  type TripAuditDecision
} from "./tripWindow"

// Atomic for the same reason the limiter's own script is (`redisAdapter.ts`): two refusals arriving
// together must not both see themselves as the first of the window. The window's count expires with
// the window; the carried count outlives it so the key's next first refusal can report it.
const COUNT_TRIP_SCRIPT = `
local refusals = redis.call("INCR", KEYS[1])
if refusals == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
  local carried = tonumber(redis.call("GET", KEYS[2]) or "0")
  redis.call("DEL", KEYS[2])
  return { refusals, carried }
end
redis.call("SET", KEYS[2], refusals - 1, "PX", ARGV[2])
return { refusals, 0 }
`

const TRIP_COUNTER_KEY: unique symbol = Symbol.for("remit.rateLimit.tripFallback")

type TripCounterHolder = {
  [TRIP_COUNTER_KEY]?: ReturnType<typeof createInMemoryTripCounter>
}

// One fallback per process, held on `globalThis` for the reason `index.ts` holds the limiter there:
// the proxy and the route handlers load this module under separate ids.
const fallback = ((globalThis as TripCounterHolder)[TRIP_COUNTER_KEY] ??=
  createInMemoryTripCounter())

export async function countRateLimitTrip(
  key: string,
  windowMs: number
): Promise<TripAuditDecision> {
  try {
    const client = await getRateLimitConnection()
    const reply = await client.eval(
      COUNT_TRIP_SCRIPT,
      2,
      ...toTripKeys(key),
      windowMs,
      TRIP_CARRY_TTL_MS
    )

    return decideTripAudit(parseTripReply(reply))
  } catch {
    // Not logged: a refusal reaches this only after the limiter made the same round trip, and
    // `redisAdapter.ts` already reports the outage once, when it starts.
    return decideTripAudit(fallback.count(key, windowMs))
  }
}
