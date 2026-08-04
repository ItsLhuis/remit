import { randomUUID } from "node:crypto"
import path from "node:path"

import * as p from "@clack/prompts"

import chalk from "chalk"

import { resolveLocalUploadsDirectory } from "@/lib/storage/local"

import pkg from "@/package.json"

import { buildPreRestoreSnapshotPath, formatArchiveTimestamp } from "../backup/filename"
import { formatBytes } from "../utils/format"

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
import { applyUploadsAtomicSwap } from "./uploadsSwap"
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
    client: null,
    database: null,
    databaseApplied: false,
    schema: null,
    snapshotPath: null,
    stagedUploadsDir: null,
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
    const liveUploadsDir = resolveLocalUploadsDirectory(remitDataDir)
    const uploadsBaseName = path.basename(liveUploadsDir)
    const stagingToken = `${timestamp}-${randomUUID()}`

    state.workDir = path.join(remitDataDir, `.restore-work-${stagingToken}`)
    state.stagedUploadsDir = path.join(
      path.dirname(liveUploadsDir),
      `.${uploadsBaseName}.restore-staging-${stagingToken}`
    )

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
      uploadsStagingDir: state.stagedUploadsDir,
      workDir: state.workDir
    })

    const databaseName = getDatabaseName(env.DATABASE_URL)

    if (parsed.data.dryRun) {
      p.note(
        formatDryRunSummary({
          archivePath: formatRestoreSourceForAudit(restoreSource),
          databaseName,
          liveUploadsDir,
          manifest: verified.manifest
        }),
        "Dry run"
      )
      p.outro(
        "Dry run complete. No snapshot, audit entry, database restore, or uploads swap was performed."
      )
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

    if (!verified.databaseDumpPath || !verified.uploadsStagingDir) {
      throw new RestoreCliError(
        "Restore verification did not produce staged database and uploads artifacts.",
        "restore-staging-missing"
      )
    }

    await restoreDatabaseDump(verified.databaseDumpPath, env.DATABASE_URL)
    state.databaseApplied = true

    await applyUploadsAtomicSwap({
      expectedUploads: verified.uploads,
      liveUploadsDir,
      stagingUploadsDir: verified.uploadsStagingDir,
      timestamp: stagingToken
    })
    state.stagedUploadsDir = null

    await runPostRestoreMigrations(env.DATABASE_URL)
    await replayPreRestoreAuditTrail(state)
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
  liveUploadsDir: string
  manifest: RestoreManifest
}): string {
  return [
    `${chalk.bold("Archive")}: ${input.archivePath}`,
    `${chalk.bold("Created")}: ${input.manifest.createdAt}`,
    `${chalk.bold("Archive app version")}: ${input.manifest.appVersion}`,
    `${chalk.bold("Schema migration")}: ${input.manifest.schemaMigrationId}`,
    `${chalk.bold("Destination recorded")}: ${input.manifest.destination}`,
    `${chalk.bold("Database target")}: ${input.databaseName}`,
    `${chalk.bold("Database dump")}: ${formatBytes(input.manifest.components.database.size)}`,
    `${chalk.bold("Uploads target")}: ${input.liveUploadsDir}`,
    `${chalk.bold("Uploads")}: ${input.manifest.components.uploads.fileCount} files, ${formatBytes(
      input.manifest.components.uploads.totalSize
    )}`,
    "",
    "Would create a mandatory local pre-restore snapshot, run pg_restore with --single-transaction, apply forward migrations, and atomically swap uploads."
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
