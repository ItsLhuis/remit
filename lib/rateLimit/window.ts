import { z } from "zod"

import { type RateLimitResult } from "./types"

// One prefix for every counter, so a rate-limit key can never collide with BullMQ's `bull:*` keys or
// `lib/jobs/stats.ts`'s metrics hash in the same Redis database, and an operator can find or clear
// every counter with one pattern without touching the queue.
const RATE_LIMIT_KEY_PREFIX = "remit:ratelimit:"

// `redisAdapter.ts`'s script returns `{ count, pttl }`. Validated rather than cast: a reply of any
// other shape is treated as a store failure, and the caller falls back instead of trusting it.
const windowReplySchema = z.tuple([z.number().int().min(1), z.number().int()])

export type WindowReply = z.infer<typeof windowReplySchema>

export function toRateLimitKey(key: string): string {
  return `${RATE_LIMIT_KEY_PREFIX}${key}`
}

export function parseWindowReply(reply: unknown): WindowReply {
  return windowReplySchema.parse(reply)
}

// `resetAt` is derived from the key's remaining TTL rather than from `now + windowMs`: the window
// opened at the first request in it, which may have been served by another process, so only Redis
// knows when it closes.
export function toRateLimitResult(
  [count, remainingMs]: WindowReply,
  max: number,
  now: number
): RateLimitResult {
  return {
    allowed: count <= max,
    remaining: Math.max(0, max - count),
    resetAt: new Date(now + Math.max(0, remainingMs))
  }
}
