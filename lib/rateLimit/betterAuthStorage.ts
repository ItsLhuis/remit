import { type BetterAuthRateLimitStorage } from "better-auth"

import { type RateLimitAdapter } from "./types"

// Its own segment under the limiter's prefix, so an auth counter can never share a key with a route
// limit that happens to key on the same address. Better Auth's own key is `<ip>|<path>`.
const BETTER_AUTH_KEY_PREFIX = "auth:"

// Better Auth's sign-in, sign-up and password-reset limits, counted by the same adapter every other
// limit in Remit uses: one fixed window in Redis, shared by every process and surviving a
// restart, falling back per process while Redis is unreachable. Better Auth keeps choosing the rule
// for each path, `lib/auth/index.ts`'s `customRules` included; only where the count lives changes.
//
// `get` and `set` exist because Better Auth's type requires them, and are never called: its
// rate limiter (`better-auth`'s `api/rate-limiter`, `onRequestRateLimit`) takes the atomic `consume`
// whenever a storage provides one, and falls back to a non-atomic read-then-write through `get` and
// `set` only when it does not. Answering `get` with nothing keeps that fallback inert rather than
// letting it count beside the adapter if a future version ever reached it.
export function toBetterAuthRateLimitStorage(
  adapter: RateLimitAdapter
): BetterAuthRateLimitStorage {
  return {
    async get() {
      return null
    },
    async set() {},
    async consume(key, { window, max }) {
      const result = await adapter.consume(`${BETTER_AUTH_KEY_PREFIX}${key}`, max, window * 1000)

      if (result.allowed) return { allowed: true, retryAfter: null }

      return {
        allowed: false,
        retryAfter: Math.max(1, Math.ceil((result.resetAt.getTime() - Date.now()) / 1000))
      }
    }
  }
}
