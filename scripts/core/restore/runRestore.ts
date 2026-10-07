import { randomUUID } from "node:crypto"
import path from "node:path"

import * as p from "@clack/prompts"

import { acquireBackupLock, findBackupLockHolder } from "@/lib/backups/backupLock"
import { describeBackupLockHolder } from "@/lib/backups/backupLockHolder"

import migrationJournal from "@/drizzle/migrations/meta/_journal.json"
import pkg from "@/package.json"

import { buildPreRestoreSnapshotPath, formatArchiveTimestamp } from "../backup/filename"

import { deleteObjectsAbsentFromArchive, putArchivedObjects } from "./applyObjects"
import { getRestoreHelpText, parseRestoreArgs } from "./args"
import {
  cleanupRuntimeState,
  replayPreRestoreAuditTrail,
  writeAbortAuditIfAllowed,
  writeRestoreAudit,
  type RestoreRuntimeState
} from "./auditTrail"
import { confirmDestructiveRestore, confirmOlderArchiveSchema } from "./confirm"
import { formatDryRunSummary } from "./dryRunSummary"
import { RestoreCliError } from "./errors"
import { readAndValidateRestoreHeader } from "./header"
import { runPostRestoreMigrations } from "./postRestoreMigrations"
import { redactRestoreReason } from "./redact"
import {
  downloadRemoteRestoreArchive,
  formatRestoreSourceForAudit,
  parseRestoreSource,
  type RestoreSource
} from "./remoteDownload"
import { restoreDatabaseDump } from "./restoreDump"
import { assertArchiveSchemaRestorable, compareArchiveSchema } from "./schemaGate"
import { takePreRestoreSnapshot } from "./snapshot"
import { getDatabaseName, verifyArchivePayload, type ChecksumDescriptor } from "./verifyArchive"

export async function runRestore(): Promise<void> {
  const parsed = parseRestoreArgs(process.argv.slice(2))

  if ("error" in parsed) {
    console.error(parsed.error)
    console.log("")
    console.log(getRestoreHelpText())
    process.exit(1)
  }

  if (parsed.data.help) {
    console.log(getRestoreHelpText())
    process.exit(0)
  }

  p.intro("Remit restore")

  const state: RestoreRuntimeState = {
    auditTrail: [],
    backupLock: null,
    client: null,
    database: null,
    databaseApplied: false,
    schema: null,
    snapshotPath: null,
    stagedObjectsDir: null,
    workDir: null
  }
  const operationId = randomUUID()
  const restoreSource = parseRestoreSource(parsed.data.backupFile)
  let archivePath = formatRestoreSourceForAudit(restoreSource)
  // Every exit goes through the `finally` below rather than `process.exit` inside the `try`: an
  // exit there skips the `finally`, which is what removes the staged dump and files and releases the
  // backup lock.
  let exitCode = 1

  try {
    const { env } = await import("@/lib/config/env")

    const encryptionKey = Buffer.from(env.REMIT_ENCRYPTION_KEY, "base64")
    const remitDataDir = path.resolve(env.REMIT_DATA_DIR)
    const snapshotDate = new Date()
    const timestamp = formatArchiveTimestamp(snapshotDate)
    const stagingToken = `${timestamp}-${randomUUID()}`

    state.workDir = path.join(remitDataDir, `.restore-work-${stagingToken}`)
    state.stagedObjectsDir = path.join(remitDataDir, `.restore-objects-${stagingToken}`)

    if (restoreSource.type === "remote") {
      const [{ database, client }, schema] = await Promise.all([
        import("@/database"),
        import("@/database/schema")
      ])

      state.database = database
      state.client = client
      state.schema = schema
      archivePath = await downloadRemoteRestoreArchive(restoreSource, database, state.workDir)
    } else {
      archivePath = path.resolve(restoreSource.path)
    }

    const header = await readAndValidateRestoreHeader(archivePath, encryptionKey)
    const verified = await verifyArchivePayload({
      archivePath,
      currentAppVersion: pkg.version,
      encryptionKey,
      header,
      mode: parsed.data.dryRun ? "verify-only" : "stage",
      objectsStagingDir: state.stagedObjectsDir,
      workDir: state.workDir
    })

    const databaseName = getDatabaseName(env.DATABASE_URL)
    const schemaComparison = compareArchiveSchema(
      verified.manifest.schemaMigrationId,
      migrationJournal.entries.map((entry) => entry.tag)
    )

    if (parsed.data.dryRun) {
      p.note(
        formatDryRunSummary({
          archivePath: formatRestoreSourceForAudit(restoreSource),
          databaseName,
          manifest: verified.manifest,
          objects: verified.objects,
          schemaComparison
        }),
        "Dry run"
      )
      assertArchiveSchemaRestorable(schemaComparison)
      p.outro("Dry run complete. No snapshot, audit entry, database restore or file was written.")
      exitCode = 0

      return
    }

    assertArchiveSchemaRestorable(schemaComparison)

    if (
      schemaComparison.kind === "older" &&
      !(await confirmOlderArchiveSchema({
        acceptOlderSchema: parsed.data.acceptOlderSchema,
        comparison: schemaComparison,
        yes: parsed.data.yes
      }))
    ) {
      p.cancel("Restore cancelled. No restore was applied.")
      exitCode = 0

      return
    }

    if (!state.database || !state.client || !state.schema) {
      const [{ database, client }, schema] = await Promise.all([
        import("@/database"),
        import("@/database/schema")
      ])

      state.database = database
      state.client = client
      state.schema = schema
    }

    const { client, database, schema } = state

    // Held from before the snapshot until the process ends, and taken before the started entry so a
    // refused restore leaves no trail of having begun. The snapshot runs the backup pipeline under
    // this lock without taking it (`lib/backups/backupLock.ts`), and nothing else can start a backup
    // while files are written, the database is swapped and stale files are deleted — an archive
    // taken half-way through would hold a store and a database that never existed together.
    state.backupLock = await acquireBackupLock(client, "restore")

    if (!state.backupLock) {
      const holder = describeBackupLockHolder(await findBackupLockHolder(client))

      throw new RestoreCliError(
        `Refusing restore: ${holder} holds the backup lock. Run pnpm remit:restore again once it has finished.`,
        "backup-lock-held",
        false
      )
    }

    await writeRestoreAudit(state, "instance.restore.started", {
      schemaComparison: schemaComparison.kind,
      operationId,
      archiveAppVersion: verified.manifest.appVersion,
      archivePath: formatRestoreSourceForAudit(restoreSource),
      schemaMigrationId: verified.manifest.schemaMigrationId
    })

    // Taken before the operator confirms rather than after: `confirmDestructiveRestore` makes them
    // type this exact path back, which is only possible once the archive exists, and it is the one
    // artifact that makes the restore reversible. Nothing destructive has run yet, so a cancelled
    // restore costs only the snapshot it leaves behind.
    state.snapshotPath = buildPreRestoreSnapshotPath(remitDataDir, snapshotDate, pkg.version)
    await takePreRestoreSnapshot(database, schema, {
      databaseUrl: env.DATABASE_URL,
      encryptionKey,
      outputPath: state.snapshotPath,
      remitDataDir
    })

    p.note(state.snapshotPath, "Pre-restore snapshot")

    await writeRestoreAudit(state, "instance.restore.snapshot_taken", {
      operationId,
      archivePath: formatRestoreSourceForAudit(restoreSource),
      snapshotPath: state.snapshotPath
    })

    await confirmDestructiveRestore({
      // Read directly from process.env rather than lib/config/env: this is an
      // operator-set runtime control flag for unattended restores, not part of
      // the validated production app config.
      allowUnattended: process.env.REMIT_ALLOW_UNATTENDED_RESTORE === "1",
      databaseName,
      snapshotPath: state.snapshotPath,
      yes: parsed.data.yes
    })

    if (!verified.databaseDumpPath || !verified.objectsStagingDir) {
      throw new RestoreCliError(
        "Restore verification did not produce the staged database and files.",
        "restore-staging-missing"
      )
    }

    const { storage } = await import("@/lib/storage/s3")

    // The order is what keeps a failure repairable without an atomic swap (ADR-0046): files are
    // written and verified first, the database is replaced in one transaction second, and only then
    // is anything the archive lacks deleted. Every stop leaves the store a superset of what the
    // database names, and running the restore again completes it.
    await putArchivedObjects(storage, verified.objects)

    await restoreDatabaseDump(verified.databaseDumpPath, env.DATABASE_URL)
    state.databaseApplied = true

    // Migrations and the audit replay come before the deletions, not after: deleting is one request
    // per stale object and the step most likely to fail, and a failure there must leave a migrated
    // database with its operation trail rather than an older schema under a newer build.
    await runPostRestoreMigrations(env.DATABASE_URL)
    await replayPreRestoreAuditTrail(state)

    await deleteObjectsAbsentFromArchive(storage, verified.objects)

    await writeRestoreAudit(state, "instance.restore.completed", {
      operationId,
      archiveAppVersion: verified.manifest.appVersion,
      archivePath: formatRestoreSourceForAudit(restoreSource),
      snapshotPath: state.snapshotPath
    })

    p.outro("Restore complete.")
    exitCode = 0
  } catch (error) {
    p.cancel("Restore failed.")
    console.error(formatRestoreError(error))

    await writeAbortAuditIfAllowed(state, error, {
      archivePath: formatRestoreSourceForAudit(restoreSource),
      operationId,
      parsed: parsed.data
    })
  } finally {
    // A failed cleanup is printed and never allowed to stop the exit below: the process ending is
    // what finally releases a lock or a connection the cleanup could not.
    await cleanupRuntimeState(state).catch((error: unknown) => {
      console.error(`Restore cleanup failed: ${redactRestoreReason(error)}`)
    })

    process.exit(exitCode)
  }
}

function formatRestoreError(error: unknown): string {
  if (error instanceof RestoreCliError) return error.message

  return (
    redactRestoreReason(error) ||
    "Restore failed. Confirm the archive path, database reachability, and filesystem permissions."
  )
}

export type { ChecksumDescriptor, RestoreSource }
