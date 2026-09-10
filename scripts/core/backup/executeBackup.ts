import { mkdir, rm } from "node:fs/promises"
import path from "node:path"

import pkg from "@/package.json"

import { writeOperationalAudit } from "../audit/operationalAudit"
import { redactOperationalError } from "../cli/redact"
import { type BackupDestination, type BackupDestinationAdapter } from "../destination"

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

export class BackupCliError extends Error {}

export type BackupResult = {
  archivePath: string
  manifest: ReturnType<typeof buildBackupManifest>
  wrote: boolean
}

export type ExecuteBackupOptions = {
  databaseUrl: string
  destinationOverride?: BackupDestination
  encryptionKey: Buffer
  // The one hook the interactive command needs: the moment the plan exists is also the moment there
  // is something to show an operator and, for a local path, something to ask them. Everything else
  // the CLI adds is presentation around this call, which is why the worker can use this function
  // without a spinner ever reaching the pino log stream.
  onPlanned?: (plan: BackupPlan) => Promise<void>
  output: string | null
  remitDataDir: string
  skipStatusUpdate?: boolean
  // Distinguishes a scheduled run from an operator's in the audit trail; both write the same events
  // against the same status columns, and this is what tells the two apart when reading the trail.
  userAgent: string
}

// The whole backup, with no presentation and no prompts: plan, dump, archive, upload, prune, record.
// Both entry points run exactly this — `runBackup.ts` wraps it for the operator and
// `features/backups/jobs.ts` calls it on the schedule — so a `.remitbak` archive has one producer
// and `pnpm remit:restore` has one format to accept.
export async function executeBackup(
  database: Database,
  schema: Schema,
  options: ExecuteBackupOptions
): Promise<BackupResult> {
  let settingsRow: Awaited<ReturnType<Database["query"]["settings"]["findFirst"]>>

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

    await options.onPlanned?.(plan)

    const result = await writeBackupArchive(database, plan, options, destinationAdapter)

    if (!options.skipStatusUpdate) {
      await updateBackupSuccess(database, schema, settingsRow?.id ?? null)
      await writeBackupAudit(database, schema, "instance.backup.completed", options.userAgent, {
        destination: plan.destination,
        archive: plan.archiveUri,
        archiveAppVersion: result.manifest.appVersion,
        schemaMigrationId: result.manifest.schemaMigrationId
      })
    }

    return result
  } catch (error) {
    if (!options.skipStatusUpdate) {
      try {
        await updateBackupFailure(
          database,
          schema,
          settingsRow?.id ?? null,
          redactBackupReason(error)
        )
      } catch {
        // Status persistence failure on the failure path must not mask the original error.
      }

      await writeBackupAudit(database, schema, "instance.backup.failed", options.userAgent, {
        destination: options.destinationOverride ?? settingsRow?.backupDestination ?? "local",
        reason: redactBackupReason(error)
      })
    }

    throw error
  }
}

async function writeBackupArchive(
  database: Database,
  plan: BackupPlan,
  options: ExecuteBackupOptions,
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

// Swallowed rather than surfaced: the archive is already written and uploaded by the time this runs,
// and failing the backup over a missing trail entry would discard a good archive.
async function writeBackupAudit(
  database: Database,
  schema: Schema,
  event: string,
  userAgent: string,
  metadata: Record<string, unknown>
): Promise<void> {
  try {
    await writeOperationalAudit({ database, schema, event, userAgent, metadata })
  } catch (auditError) {
    console.warn(`Failed to write backup audit entry: ${String(auditError)}`)
  }
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
