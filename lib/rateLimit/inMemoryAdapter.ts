import { type RateLimitAdapter, type RateLimitResult } from "./types"

type Entry = {
  count: number
  resetAt: number
}

// Process-local and never swept: counters live only in this process's heap and expired entries are
// overwritten on next use rather than evicted on a timer. Both are acceptable because Remit is
// structurally single-instance (see AGENTS.md) and the key space is bounded by the callers' own
// keys. A deployment that ever runs more than one app process needs a shared adapter instead —
// this one would give each process its own independent allowance.
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
