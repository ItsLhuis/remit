type Database = typeof import("@/database").database
type Schema = typeof import("@/database/schema")

export type WriteOperationalAuditInput = {
  database: Database
  schema: Schema
  event: string
  metadata: Record<string, unknown>
  userAgent: string
}

export async function writeOperationalAudit(input: WriteOperationalAuditInput): Promise<void> {
  await input.database.insert(input.schema.auditLogs).values({
    event: input.event,
    actorUserId: null,
    actorRole: null,
    targetEntityType: "instance",
    targetEntityId: null,
    metadata: input.metadata,
    ipAddress: null,
    userAgent: input.userAgent
  })
}
