import { type RateLimitAdapter, type RateLimitResult } from "./types"

type Entry = {
  count: number
  resetAt: number
}

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
