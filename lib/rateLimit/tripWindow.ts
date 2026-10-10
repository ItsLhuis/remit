import { z } from "zod"

// Its own prefix, apart from the limiter's counters in `window.ts`, so counting refusals can never
// move a limit and an operator can clear one without touching the other.
const TRIP_KEY_PREFIX = "remit:ratelimit-trip:"

// How long the count of a window's suppressed refusals waits for the key's next trip to report it.
// A flood that stops and never returns within a day leaves its last window's count only in the
// first refusal's entry, as "this key was refused"; one that returns reports it in full.
export const TRIP_CARRY_TTL_MS = 24 * 60 * 60 * 1000

const tripReplySchema = z.tuple([z.number().int().min(1), z.number().int().min(0)])

// `refusals` is this one's position in the current window; `carried` is how many refusals the key's
// previous window suppressed, handed over only to the first refusal of the next one.
export type TripReply = z.infer<typeof tripReplySchema>

export type TripAuditDecision =
  | { write: true; suppressedSincePreviousEntry: number }
  | { write: false }

export function toTripKeys(key: string): [windowKey: string, carryKey: string] {
  return [`${TRIP_KEY_PREFIX}window:${key}`, `${TRIP_KEY_PREFIX}carry:${key}`]
}

export function parseTripReply(reply: unknown): TripReply {
  return tripReplySchema.parse(reply)
}

// One audit entry per key per window: the first refusal writes it, carrying the count the previous
// window suppressed, and every later refusal in the window is only counted. A flood from one address
// is therefore a handful of rows that still say how big it was, not one row per request.
export function decideTripAudit([refusals, carried]: TripReply): TripAuditDecision {
  if (refusals !== 1) return { write: false }

  return { write: true, suppressedSincePreviousEntry: carried }
}

type TripWindow = { refusals: number; expiresAt: number }

type TripCarry = { suppressed: number; expiresAt: number }

// The same counting in process memory, for while Redis is unreachable: per process and lost on
// restart, exactly like the limiter's own fallback (`inMemoryAdapter.ts`).
export function createInMemoryTripCounter(now: () => number = Date.now) {
  const windows = new Map<string, TripWindow>()
  const carries = new Map<string, TripCarry>()

  return {
    count(key: string, windowMs: number): TripReply {
      const time = now()
      const current = windows.get(key)

      if (!current || current.expiresAt <= time) {
        const carry = carries.get(key)

        carries.delete(key)
        windows.set(key, { refusals: 1, expiresAt: time + windowMs })

        return [1, carry && carry.expiresAt > time ? carry.suppressed : 0]
      }

      current.refusals += 1
      carries.set(key, { suppressed: current.refusals - 1, expiresAt: time + TRIP_CARRY_TTL_MS })

      return [current.refusals, 0]
    }
  }
}
