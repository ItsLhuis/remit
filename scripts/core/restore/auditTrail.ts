import { sql } from "drizzle-orm"

import { writeOperationalAudit } from "../audit/operationalAudit"

import { type RestoreCliOptions } from "./args"
import { RestoreCliError } from "./errors"
import { redactRestoreReason } from "./redact"

type Database = typeof import("@/database").database
type DatabaseClient = typeof import("@/database").client
type Schema = typeof import("@/database/schema")

export type RestoreAuditEvent =
  | "instance.restore.started"
  | "instance.restore.snapshot_taken"
  | "instance.restore.completed"
  | "instance.restore.aborted"

export type RestoreAuditRecord = {
  event: RestoreAuditEvent
  metadata: Record<string, unknown>
}

export type RestoreRuntimeState = {
  auditTrail: RestoreAuditRecord[]
  client: DatabaseClient | null
  database: Database | null
  databaseApplied: boolean
  schema: Schema | null
  snapshotPath: string | null
  stagedUploadsDir: string | null
  workDir: string | null
}

const CLI_USER_AGENT = "cli/restore"

export async function writeRestoreAudit(
  state: RestoreRuntimeState,
  event: RestoreAuditEvent,
  metadata: Record<string, unknown>
): Promise<void> {
  if (!state.database || !state.schema) {
    throw new RestoreCliError(
      "Restore audit database is not available.",
      "restore-audit-unavailable"
    )
  }

  if (event !== "instance.restore.completed" && event !== "instance.restore.aborted") {
    state.auditTrail.push({ event, metadata })
  }

  await writeOperationalAudit({
    database: state.database,
    schema: state.schema,
    event,
    metadata,
    userAgent: CLI_USER_AGENT
  })
}

export async function replayPreRestoreAuditTrail(state: RestoreRuntimeState): Promise<void> {
  if (!state.databaseApplied || !state.database || !state.schema) return
  if (state.auditTrail.length === 0) return

  // The restored dump replaced the live database, so the pre-restore audit rows are gone. On the
  // success path the forward migrations have already re-created `audit_logs`, but on the abort path
  // the replay can run before them, against an older dump that predates the table. The replay is
  // skipped with a warning rather than failing the restore on a missing-table insert.
  if (!(await auditLogsTableExists(state.database))) {
    console.warn(
      "Restored database has no audit_logs table; skipping pre-restore audit replay. Forward migrations will create it on the next start."
    )
    state.auditTrail = []
    return
  }

  for (const record of state.auditTrail) {
    await writeOperationalAudit({
      database: state.database,
      schema: state.schema,
      event: record.event,
      metadata: {
        ...record.metadata,
        replayedAfterDatabaseRestore: true
      },
      userAgent: CLI_USER_AGENT
    })
  }

  state.auditTrail = []
}

async function auditLogsTableExists(database: Database): Promise<boolean> {
  const rows = await database.execute(sql`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'audit_logs'
    ) AS exists
  `)
  const [row] = Array.from(rows as Iterable<{ exists: boolean }>)

  return Boolean(row?.exists)
}

export async function writeAbortAuditIfAllowed(
  state: RestoreRuntimeState,
  error: unknown,
  input: {
    archivePath: string
    operationId: string
    parsed: RestoreCliOptions
  }
): Promise<void> {
  if (input.parsed.dryRun) return
  if (error instanceof RestoreCliError && !error.auditEligible) return

  try {
    if (!state.database || !state.schema) {
      const [{ database, client }, schema] = await Promise.all([
        import("@/database"),
        import("@/database/schema")
      ])
      state.database = database
      state.client = client
      state.schema = schema
    }

    await replayPreRestoreAuditTrail(state)
    await writeRestoreAudit(state, "instance.restore.aborted", {
      operationId: input.operationId,
      archivePath: input.archivePath,
      reason: redactRestoreReason(error),
      snapshotPath: state.snapshotPath
    })
  } catch (auditError) {
    // The original restore failure stays the message the operator acts on. The secondary audit
    // failure is still printed, so the lost operational visibility is not silent.
    console.error(`Failed to write restore abort audit entry: ${redactRestoreReason(auditError)}`)
  }
}

export async function cleanupRuntimeState(state: RestoreRuntimeState): Promise<void> {
  const { rm } = await import("node:fs/promises")

  await Promise.all([
    state.workDir ? rm(state.workDir, { recursive: true, force: true }) : Promise.resolve(),
    state.stagedUploadsDir
      ? rm(state.stagedUploadsDir, { recursive: true, force: true })
      : Promise.resolve()
  ])

  if (state.client) {
    await state.client.end()
  }
}
