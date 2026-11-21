import { type ApiTokenExpiryOption } from "../schemas"

export type ApiTokenStatus = "active" | "revoked" | "expired"

const DAY_MS = 24 * 60 * 60 * 1000

export function resolveApiTokenExpiry(option: ApiTokenExpiryOption, now: Date): Date | null {
  if (option === "never") return null

  return new Date(now.getTime() + Number(option) * DAY_MS)
}

// The list's badge, derived at read time. It must agree with the refusal
// `features/api/services/apiAccess.ts`'s `evaluateApiTokenAccess` applies, down to the boundary: a
// token whose expiry equals the current instant is already refused there, so it is already
// `expired` here.
export function getApiTokenStatus(
  token: { revokedAt: Date | null; expiresAt: Date | null },
  now: Date
): ApiTokenStatus {
  if (token.revokedAt) return "revoked"

  if (token.expiresAt && token.expiresAt.getTime() <= now.getTime()) return "expired"

  return "active"
}
