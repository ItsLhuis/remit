import { logger } from "@/lib/logger"

import { countRateLimitTrip } from "@/lib/rateLimit"

import { database } from "@/database"
import { auditLogs } from "@/database/schema"

export type AuditEvent =
  | "auth.login.succeeded"
  | "auth.login.failed"
  | "auth.password.changed"
  | "auth.totp.reconfigured"
  | "auth.backup_code.consumed"
  | "auth.password_reset.email_requested"
  | "auth.password_reset.cli_issued"
  | "auth.rate_limit.tripped"

export type WriteAuditOptions = {
  actorUserId?: string | null
  actorRole?: "owner" | "accountant" | "assistant" | null
  targetEntityType?: string | null
  targetEntityId?: string | null
  metadata?: Record<string, unknown>
  ipAddress?: string | null
  userAgent?: string | null
}

export async function writeAudit(
  event: AuditEvent | string,
  options: WriteAuditOptions = {}
): Promise<void> {
  try {
    await database.insert(auditLogs).values({
      event,
      actorUserId: options.actorUserId ?? null,
      actorRole: options.actorRole ?? null,
      targetEntityType: options.targetEntityType ?? null,
      targetEntityId: options.targetEntityId ?? null,
      metadata: options.metadata ?? null,
      ipAddress: options.ipAddress ?? null,
      userAgent: options.userAgent ?? null
    })
  } catch (error) {
    // Swallowed deliberately: audit writes sit inside auth flows, and a failing insert must not
    // block a login, a password change or a rate-limit rejection from completing. The trade is
    // explicit — a lost audit entry is preferred over a denial of service on the flow it records,
    // and the logger line is the only remaining trace when that happens.
    logger.error({ action: "writeAudit", event, err: error }, "Audit log insert failed")
  }
}

export type RateLimitTrip = {
  // The key and window the refusing limiter counted under, so a trip is windowed exactly as the
  // limit that refused it.
  key: string
  windowMs: number
}

// Windowed because a row per refused request would make a flood from one address a flood of rows in
// a table nothing may prune (`audit_logs` is insert-only). The first refusal of each window writes
// the entry and the rest are only counted; the next entry for the key carries how many the previous
// window suppressed (`lib/rateLimit/tripWindow.ts`). Every site that refuses on a rate limit goes
// through here, so no site can fall back to a row per request.
export async function writeRateLimitTripAudit(
  trip: RateLimitTrip,
  options: WriteAuditOptions = {}
): Promise<void> {
  const decision = await countRateLimitTrip(trip.key, trip.windowMs)

  if (!decision.write) return

  await writeAudit("auth.rate_limit.tripped", {
    ...options,
    metadata: {
      ...options.metadata,
      suppressedSincePreviousEntry: decision.suppressedSincePreviousEntry
    }
  })
}
