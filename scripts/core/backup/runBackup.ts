import { mkdir, rm } from "node:fs/promises"
import path from "node:path"

import * as p from "@clack/prompts"

import chalk from "chalk"

import pkg from "@/package.json"

import { writeOperationalAudit } from "../audit/operationalAudit"
import { exitOnCancel } from "../cli/exitOnCancel"
import { redactOperationalError } from "../cli/redact"
import type { BackupDestination, BackupDestinationAdapter } from "../destination"
import { formatBytes } from "../utils/format"
import { pathExists } from "../utils/fs"

import type { BackupCliOptions } from "./args"
import { buildConfiguredDestinationAdapter } from "./credentials"
import { dumpDatabaseToTempFile, type DatabaseDumpDescriptor } from "./databaseDump"
import { DEFAULT_BACKUP_DIRNAME } from "./filename"
import { buildBackupManifest, serializeBackupManifest, sha256Hex } from "./manifest"
import { buildBackupPlan, getLatestAppliedMigrationId, type BackupPlan } from "./plan"
import { updateBackupFailure, updateBackupSuccess } from "./statusUpdate"
import { buildChecksumsFile, describeUploads } from "./uploads"
import { enforceRemoteRetention, uploadArchive, writeEncryptedTar } from "./writeArchive"

type Database = typeof import("@/database").database
type Schema = typeof import("@/database/schema")
type SettingsRow = Awaited<ReturnType<Database["query"]["settings"]["findFirst"]>>

export class BackupCliError extends Error {}

const CLI_USER_AGENT = "cli/backup"

export type RunBackupOptions = BackupCliOptions & {
  databaseUrl: string
  destinationOverride?: BackupDestination
  encryptionKey: Buffer
  remitDataDir: string
  skipStatusUpdate?: boolean
}

export type BackupResult = {
  archivePath: string
  manifest: ReturnType<typeof buildBackupManifest>
  wrote: boolean
}

export async function runBackup(
  database: Database,
  schema: Schema,
  options: RunBackupOptions
): Promise<BackupResult> {
  const planSpinner = p.spinner()
  let planSpinnerActive = true

  planSpinner.start("Building backup plan...")

  let settingsRow: SettingsRow | undefined

  try {
    settingsRow = await database.query.settings.findFirst()

    const plan = await buildBackupPlan(
      database,
      options.destinationOverride ?? settingsRow?.backupDestination ?? "local",
      settingsRow,
      options
    )
    const destinationAdapter =
      plan.destination === "local"
        ? null
        : buildConfiguredDestinationAdapter(plan.destination, settingsRow)

    planSpinner.stop("Backup plan ready.")
    planSpinnerActive = false

    p.note(formatPlan(plan), options.dryRun ? "Dry run" : "Plan")

    if (options.dryRun) {
      return {
        archivePath: plan.archiveUri,
        manifest: buildBackupManifest({
          appVersion: pkg.version,
          checksumsSha256: "0".repeat(64),
          components: {
            database: { size: 0, sha256: "0".repeat(64) },
            uploads: { fileCount: plan.uploads.length, totalSize: plan.uploadsTotalSize }
          },
          createdAt: new Date().toISOString(),
          destination: plan.destination,
          encryptionKey: options.encryptionKey,
          schemaMigrationId: await getLatestAppliedMigrationId(database)
        }),
        wrote: false
      }
    }

    if (plan.destination === "local") {
      await confirmOverwrite(plan.outputPath, options.yes)
    }

    const archiveSpinner = p.spinner()
    archiveSpinner.start(
      plan.destination === "local"
        ? "Writing encrypted backup archive..."
        : "Writing encrypted backup archive and uploading..."
    )

    try {
      const result = await writeBackupArchive(database, plan, options, destinationAdapter)

      if (!options.skipStatusUpdate) {
        await updateBackupSuccess(database, schema, settingsRow?.id ?? null)
        try {
          await writeOperationalAudit({
            database,
            schema,
            event: "instance.backup.completed",
            userAgent: CLI_USER_AGENT,
            metadata: {
              destination: plan.destination,
              archive: plan.archiveUri,
              archiveAppVersion: result.manifest.appVersion,
              schemaMigrationId: result.manifest.schemaMigrationId
            }
          })
        } catch (auditError) {
          console.warn(`Failed to write backup audit entry: ${String(auditError)}`)
        }
      }

      archiveSpinner.stop(
        plan.destination === "local" ? "Encrypted archive written." : "Encrypted archive uploaded."
      )
      return result
    } catch (error) {
      archiveSpinner.stop("Archive write failed.")
      throw error
    }
  } catch (error) {
    if (planSpinnerActive) planSpinner.stop("Backup plan failed.")

    try {
      if (!options.skipStatusUpdate) {
        await updateBackupFailure(
          database,
          schema,
          settingsRow?.id ?? null,
          redactBackupReason(error)
        )
      }
    } catch {
      // Status persistence failure on the failure path must not mask the original error.
    }

    if (!options.skipStatusUpdate) {
      try {
        await writeOperationalAudit({
          database,
          schema,
          event: "instance.backup.failed",
          userAgent: CLI_USER_AGENT,
          metadata: {
            destination: options.destinationOverride ?? settingsRow?.backupDestination ?? "local",
            reason: redactBackupReason(error)
          }
        })
      } catch (auditError) {
        console.warn(`Failed to write backup audit entry: ${String(auditError)}`)
      }
    }
    throw error
  }
}

async function writeBackupArchive(
  database: Database,
  plan: BackupPlan,
  options: RunBackupOptions,
  destinationAdapter: BackupDestinationAdapter | null
): Promise<BackupResult> {
  if (options.encryptionKey.length !== 32) {
    throw new BackupCliError("REMIT_ENCRYPTION_KEY must decode to 32 bytes.")
  }

  const tempDir = path.join(path.resolve(options.remitDataDir), DEFAULT_BACKUP_DIRNAME, ".tmp")
  await mkdir(tempDir, { recursive: true })

  const dump: DatabaseDumpDescriptor = await dumpDatabaseToTempFile(options.databaseUrl, tempDir)
  const uploadDescriptors = await describeUploads(plan.uploads)
  const checksums = buildChecksumsFile(dump, uploadDescriptors)
  const checksumsBuffer = Buffer.from(checksums, "utf8")
  const manifest = buildBackupManifest({
    appVersion: pkg.version,
    checksumsSha256: sha256Hex(checksumsBuffer),
    components: {
      database: { size: dump.size, sha256: dump.sha256 },
      uploads: {
        fileCount: uploadDescriptors.length,
        totalSize: uploadDescriptors.reduce((sum, upload) => sum + upload.size, 0)
      }
    },
    createdAt: new Date().toISOString(),
    destination: plan.destination,
    encryptionKey: options.encryptionKey,
    schemaMigrationId: await getLatestAppliedMigrationId(database)
  })

  try {
    await writeEncryptedTar({
      checksums: checksumsBuffer,
      databaseDump: dump,
      encryptionKey: options.encryptionKey,
      manifest: serializeBackupManifest(manifest),
      outputPath: plan.outputPath,
      uploads: uploadDescriptors
    })
  } finally {
    await rm(dump.path, { force: true })
  }

  if (plan.destination !== "local") {
    if (!destinationAdapter || !plan.objectKey) {
      throw new BackupCliError("Remote backup destination was not configured.")
    }

    await uploadArchive(destinationAdapter, plan.outputPath, plan.objectKey)
    await enforceRemoteRetention(destinationAdapter, plan)
  }

  return { archivePath: plan.archiveUri, manifest, wrote: true }
}

async function confirmOverwrite(outputPath: string, yes: boolean): Promise<void> {
  if (!(await pathExists(outputPath))) return
  if (yes) return

  const confirmed = await p.confirm({
    message: `Overwrite existing backup at ${outputPath}?`,
    initialValue: false
  })

  exitOnCancel(confirmed, "Backup cancelled.")

  if (!confirmed) {
    p.cancel("No archive was written.")
    process.exit(0)
  }
}

function formatPlan(plan: BackupPlan): string {
  return [
    `${chalk.bold("Destination")}: ${plan.destination}`,
    `${chalk.bold("Archive")}: ${plan.archiveUri}`,
    `${chalk.bold("Uploads directory")}: ${plan.uploadsDirectory}`,
    `${chalk.bold("Uploads")}: ${plan.uploads.length} files, ${formatBytes(plan.uploadsTotalSize)}`,
    "",
    chalk.bold("Tables"),
    ...plan.tableNames.map((table) => `  ${table}`)
  ].join("\n")
}

export function redactBackupReason(error: unknown): string {
  return redactOperationalError(error, {
    hint: (message) => {
      if (message.includes("spawn pg_dump ENOENT")) {
        return "pg_dump is not installed on this machine. Run the backup in the app container with docker compose exec app pnpm remit:backup, or install the PostgreSQL 16 client locally and retry."
      }

      if (message.includes("ECONNREFUSED") || message.startsWith("Failed query:")) {
        return "Database unavailable. Run pnpm services:up first and confirm the app container can reach PostgreSQL."
      }

      return null
    }
  })
}

export function formatBackupError(error: unknown): string {
  if (error instanceof BackupCliError) return error.message

  return (
    redactBackupReason(error) ||
    "Backup failed. Run pnpm services:up first and confirm database and filesystem access."
  )
}
