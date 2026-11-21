import { type RateLimitResult } from "./types"

export type RateLimitPolicy = {
  name: string
  max: number
  windowMs: number
}

// The `RateLimit-Policy` and `RateLimit` fields of the IETF HTTPAPI draft
// (draft-ietf-httpapi-ratelimit-headers-11), structured-field lists of one named item each:
// `q` the quota and `w` the window in seconds, `r` what remains and `t` the seconds until it resets.
// No `pk` partition key is sent: the key names the caller's token or address, and the caller already
// knows which one it used.
//
// Only a policy whose counter belongs to the caller alone may be described this way. A counter
// shared with other callers, such as a per-address backstop several integrations sit behind, would
// tell each of them how much the others had used.
export function toRateLimitHeaders(
  result: RateLimitResult,
  policy: RateLimitPolicy,
  now: number
): Record<string, string> {
  const secondsToReset = Math.max(0, Math.ceil((result.resetAt.getTime() - now) / 1000))

  return {
    "RateLimit-Policy": `"${policy.name}";q=${policy.max};w=${Math.ceil(policy.windowMs / 1000)}`,
    RateLimit: `"${policy.name}";r=${result.remaining};t=${secondsToReset}`,
    ...(result.allowed ? {} : { "Retry-After": String(Math.max(1, secondsToReset)) })
  }
}
