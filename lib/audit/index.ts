import { database } from "@/database"
import { auditLogs } from "@/database/schema"

import { logger } from "@/lib/logger"

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
    logger.error({ action: "writeAudit", event, err: error }, "Audit log insert failed")
  }
}
