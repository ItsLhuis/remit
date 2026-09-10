import { type RateLimitAdapter, type RateLimitResult } from "./types"

type Entry = {
  count: number
  resetAt: number
}

// Process-local and never swept: counters live only in this process's heap and expired entries are
// overwritten on next use rather than evicted on a timer. That is acceptable only because this is
// no longer the limiter anyone relies on — it is `redisAdapter.ts`'s fallback while Redis is
// unreachable, and the test double. During that fallback each app process has its own allowance
// and a restart resets it, which is the degradation ADR-0037 accepts.
export function createInMemoryAdapter(): RateLimitAdapter {
  const store = new Map<string, Entry>()

  return {
    async consume(key: string, max: number, windowMs: number): Promise<RateLimitResult> {
      const now = Date.now()
      const entry = store.get(key)

      if (!entry || now >= entry.resetAt) {
        const resetAt = now + windowMs

        store.set(key, { count: 1, resetAt })

        return { allowed: true, remaining: max - 1, resetAt: new Date(resetAt) }
      }

      entry.count++

      return {
        allowed: entry.count <= max,
        remaining: Math.max(0, max - entry.count),
        resetAt: new Date(entry.resetAt)
      }
    }
  }
}
