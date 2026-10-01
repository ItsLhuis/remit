import { randomUUID } from "node:crypto"
import path from "node:path"

import * as p from "@clack/prompts"

import chalk from "chalk"

import pkg from "@/package.json"

import { buildPreRestoreSnapshotPath, formatArchiveTimestamp } from "../backup/filename"
import { formatBytes } from "../utils/format"

import { deleteObjectsAbsentFromArchive, putArchivedObjects } from "./applyObjects"
import { getRestoreHelpText, parseRestoreArgs } from "./args"
import {
  cleanupRuntimeState,
  replayPreRestoreAuditTrail,
  writeAbortAuditIfAllowed,
  writeRestoreAudit,
  type RestoreRuntimeState
} from "./auditTrail"
import { confirmDestructiveRestore } from "./confirm"
import { RestoreCliError } from "./errors"
import { readAndValidateRestoreHeader } from "./header"
import { type RestoreManifest } from "./manifestSchema"
import { runPostRestoreMigrations } from "./postRestoreMigrations"
import { redactRestoreReason } from "./redact"
import {
  downloadRemoteRestoreArchive,
  formatRestoreSourceForAudit,
  parseRestoreSource,
  type RestoreSource
} from "./remoteDownload"
import { restoreDatabaseDump } from "./restoreDump"
import { takePreRestoreSnapshot } from "./snapshot"
import {
  getDatabaseName,
  verifyArchivePayload,
  type ChecksumDescriptor,
  type StagedObject
} from "./verifyArchive"

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

    if (parsed.data.dryRun) {
      p.note(
        formatDryRunSummary({
          archivePath: formatRestoreSourceForAudit(restoreSource),
          databaseName,
          manifest: verified.manifest,
          objects: verified.objects
        }),
        "Dry run"
      )
      p.outro("Dry run complete. No snapshot, audit entry, database restore or file was written.")
      process.exit(0)
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

    const database = state.database
    const schema = state.schema

    await writeRestoreAudit(state, "instance.restore.started", {
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
    process.exit(0)
  } catch (error) {
    p.cancel("Restore failed.")
    console.error(formatRestoreError(error))

    await writeAbortAuditIfAllowed(state, error, {
      archivePath: formatRestoreSourceForAudit(restoreSource),
      operationId,
      parsed: parsed.data
    })

    process.exit(1)
  } finally {
    await cleanupRuntimeState(state)
  }
}

function formatDryRunSummary(input: {
  archivePath: string
  databaseName: string
  manifest: RestoreManifest
  objects: readonly StagedObject[]
}): string {
  const countFor = (role: StagedObject["role"]) => {
    const objects = input.objects.filter((object) => object.role === role)

    return `${objects.length} files, ${formatBytes(objects.reduce((sum, object) => sum + object.size, 0))}`
  }

  return [
    `${chalk.bold("Archive")}: ${input.archivePath}`,
    `${chalk.bold("Created")}: ${input.manifest.createdAt}`,
    `${chalk.bold("Archive format")}: ${input.manifest.archiveFormatVersion}`,
    `${chalk.bold("Archive app version")}: ${input.manifest.appVersion}`,
    `${chalk.bold("Schema migration")}: ${input.manifest.schemaMigrationId}`,
    `${chalk.bold("Destination recorded")}: ${input.manifest.destination}`,
    `${chalk.bold("Database target")}: ${input.databaseName}`,
    `${chalk.bold("Database dump")}: ${formatBytes(input.manifest.components.database.size)}`,
    `${chalk.bold("Stored files (public)")}: ${countFor("public")}`,
    `${chalk.bold("Stored files (documents)")}: ${countFor("documents")}`,
    "",
    "Would create a mandatory local pre-restore snapshot, write and verify every archived file, run pg_restore with --single-transaction, apply forward migrations, and delete stored files the archive does not contain."
  ].join("\n")
}

function formatRestoreError(error: unknown): string {
  if (error instanceof RestoreCliError) return error.message

  return (
    redactRestoreReason(error) ||
    "Restore failed. Confirm the archive path, database reachability, and filesystem permissions."
  )
}

export type { ChecksumDescriptor, RestoreSource }
