import { mkdir, rm } from "node:fs/promises"
import path from "node:path"

import { type ObjectStore } from "@/lib/storage/objectStore"

import pkg from "@/package.json"

import { writeOperationalAudit } from "../audit/operationalAudit"
import { redactOperationalError } from "../cli/redact"
import { type BackupDestination, type BackupDestinationAdapter } from "../destination"

import { buildConfiguredDestinationAdapter } from "./credentials"
import { dumpDatabaseToTempFile, type DatabaseDumpDescriptor } from "./databaseDump"
import { DEFAULT_BACKUP_DIRNAME } from "./filename"
import { buildBackupManifest, serializeBackupManifest, sha256Hex } from "./manifest"
import { buildChecksumsFile, totalArchivedObjects } from "./objectPlan"
import { collectArchivedObjects, type CollectedObjects } from "./objects"
import { buildBackupPlan, getLatestAppliedMigrationId, type BackupPlan } from "./plan"
import { updateBackupFailure, updateBackupSuccess } from "./statusUpdate"
import {
  enforceLocalRetention,
  enforceRemoteRetention,
  uploadArchive,
  writeEncryptedTar
} from "./writeArchive"

type Database = typeof import("@/database").database
type Schema = typeof import("@/database/schema")

export class BackupCliError extends Error {}

export type BackupResult = {
  archivePath: string
  manifest: ReturnType<typeof buildBackupManifest>
  // Files the archive lacks: `uploads` rows whose object was already gone (an interrupted delete)
  // and objects deleted while the backup read them. Reported rather than fatal (`objects.ts`).
  missingObjectCount: number
  // Objects the buckets hold under a key no archive can carry, which the application never mints.
  // Left out, and reported so an operator sharing a bucket learns it holds something not backed up.
  unarchivableObjectCount: number
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

    const store = await loadRuntimeObjectStore()
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

    const result = await writeBackupArchive(
      { database, schema, store },
      plan,
      options,
      destinationAdapter
    )

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
  { database, schema, store }: { database: Database; schema: Schema; store: ObjectStore },
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

  let collected: CollectedObjects

  // Collected after the dump, never before: every file the dump references was already stored, so
  // the only file the archive can lack is one deleted while the backup ran.
  try {
    collected = await collectArchivedObjects(
      store,
      async () =>
        await database
          .select({ bucket: schema.uploads.bucket, path: schema.uploads.path })
          .from(schema.uploads)
    )
  } catch (error) {
    await rm(dump.path, { force: true })

    throw error
  }

  const { objects, missingObjectCount, unarchivableObjectCount } = collected
  const checksums = buildChecksumsFile(dump, objects)
  const checksumsBuffer = Buffer.from(checksums, "utf8")
  const manifest = buildBackupManifest({
    appVersion: pkg.version,
    checksumsSha256: sha256Hex(checksumsBuffer),
    components: {
      database: { size: dump.size, sha256: dump.sha256 },
      objects: {
        buckets: totalArchivedObjects(objects),
        contentTypes: Object.fromEntries(
          objects.map((object) => [object.archivePath, object.contentType])
        )
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
      objects,
      outputPath: plan.outputPath,
      store
    })
  } finally {
    await rm(dump.path, { force: true })
  }

  // Only an archive Remit named and placed itself is pruned around. One written to --output — every
  // pre-restore snapshot and pre-rotation backup among them — is the operator's to keep.
  if (plan.destination === "local" && options.output === null) await enforceLocalRetention(plan)

  if (plan.destination !== "local") {
    if (!destinationAdapter || !plan.objectKey) {
      throw new BackupCliError("Remote backup destination was not configured.")
    }

    await uploadArchive(destinationAdapter, plan.outputPath, plan.objectKey)
    await enforceRemoteRetention(destinationAdapter, plan)
  }

  return {
    archivePath: plan.archiveUri,
    manifest,
    missingObjectCount,
    unarchivableObjectCount,
    wrote: true
  }
}

// Imported when a backup runs rather than at module load: `lib/storage/s3.ts` validates the whole
// environment as it loads, and the CLI entry points load `.env` only once they start.
async function loadRuntimeObjectStore(): Promise<ObjectStore> {
  const { storage } = await import("@/lib/storage/s3")

  return storage
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
