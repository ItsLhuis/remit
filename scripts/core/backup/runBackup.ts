import * as p from "@clack/prompts"

import chalk from "chalk"

import pkg from "@/package.json"

import { exitOnCancel } from "../cli/exitOnCancel"
import { type BackupDestination } from "../destination"
import { formatBytes } from "../utils/format"
import { pathExists } from "../utils/fs"

import { type BackupCliOptions } from "./args"
import {
  BackupCliError,
  executeBackup,
  redactBackupReason,
  type BackupResult
} from "./executeBackup"
import { buildBackupManifest } from "./manifest"
import { totalArchivedObjects } from "./objectPlan"
import { listArchivedObjects } from "./objects"
import { buildBackupPlan, getLatestAppliedMigrationId, type BackupPlan } from "./plan"

type Database = typeof import("@/database").database
type Schema = typeof import("@/database/schema")
type ObjectTotals = ReturnType<typeof totalArchivedObjects>

type ListedObjectTotals = {
  totals: ObjectTotals
  unarchivableObjectCount: number
}

const CLI_USER_AGENT = "cli/backup"

export type RunBackupOptions = BackupCliOptions & {
  databaseUrl: string
  destinationOverride?: BackupDestination
  encryptionKey: Buffer
  remitDataDir: string
  skipStatusUpdate?: boolean
}

export { BackupCliError, redactBackupReason, type BackupResult }

// The operator-facing wrapper around `executeBackup`. Everything it adds is presentation — spinners,
// the plan note, the overwrite confirmation — and it adds it through the one `onPlanned` hook rather
// than by owning a second copy of the pipeline. The split exists because the scheduled path runs in
// the worker, whose stdout is the pino log stream an operator reads to find an error; clack's box
// drawing interleaved into that stream is a real operational cost, not a cosmetic one.
export async function runBackup(
  database: Database,
  schema: Schema,
  options: RunBackupOptions
): Promise<BackupResult> {
  if (options.dryRun) return await runBackupDryRun(database, options)

  const planSpinner = p.spinner()
  const archiveSpinner = p.spinner()
  const progress = { planned: false }

  planSpinner.start("Building backup plan...")

  try {
    const result = await executeBackup(database, schema, {
      ...options,
      userAgent: CLI_USER_AGENT,
      onPlanned: async (plan) => {
        planSpinner.stop("Backup plan ready.")
        progress.planned = true

        p.note(formatPlan(plan, (await listObjectTotals()).totals), "Plan")

        if (plan.destination === "local") await confirmOverwrite(plan.outputPath, options.yes)

        archiveSpinner.start(
          plan.destination === "local"
            ? "Writing encrypted backup archive..."
            : "Writing encrypted backup archive and uploading..."
        )
      }
    })

    archiveSpinner.stop(
      result.manifest.destination === "local"
        ? "Encrypted archive written."
        : "Encrypted archive uploaded."
    )

    if (result.missingObjectCount > 0) {
      p.log.warn(
        `${result.missingObjectCount} stored file(s) could not be archived: the database names them but they were missing from object storage, or they were deleted while the backup ran.`
      )
    }

    warnAboutUnarchivableObjects(result.unarchivableObjectCount)

    return result
  } catch (error) {
    // Which spinner is still spinning is the only thing that says where the run died, and the hook
    // that would tell us runs inside the call above. A field rather than a `let`, because a variable
    // assigned only in a callback keeps its initial narrowing here and the branch reads as dead.
    if (progress.planned) {
      archiveSpinner.stop("Archive write failed.")
    } else {
      planSpinner.stop("Backup plan failed.")
    }

    throw error
  }
}

async function runBackupDryRun(
  database: Database,
  options: RunBackupOptions
): Promise<BackupResult> {
  const planSpinner = p.spinner()

  planSpinner.start("Building backup plan...")

  try {
    const settingsRow = await database.query.settings.findFirst()
    const plan = await buildBackupPlan(
      database,
      options.destinationOverride ?? settingsRow?.backupDestination ?? "local",
      settingsRow,
      options
    )
    const { totals: objectTotals, unarchivableObjectCount } = await listObjectTotals()

    planSpinner.stop("Backup plan ready.")

    p.note(formatPlan(plan, objectTotals), "Dry run")

    warnAboutUnarchivableObjects(unarchivableObjectCount)

    return {
      archivePath: plan.archiveUri,
      manifest: buildBackupManifest({
        appVersion: pkg.version,
        checksumsSha256: "0".repeat(64),
        components: {
          database: { size: 0, sha256: "0".repeat(64) },
          objects: { buckets: objectTotals, contentTypes: {} }
        },
        createdAt: new Date().toISOString(),
        destination: plan.destination,
        encryptionKey: options.encryptionKey,
        schemaMigrationId: await getLatestAppliedMigrationId(database)
      }),
      missingObjectCount: 0,
      unarchivableObjectCount,
      wrote: false
    }
  } catch (error) {
    planSpinner.stop("Backup plan failed.")

    throw error
  }
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

// What the buckets hold as the plan is shown, for the operator's note and a dry run only: the backup
// itself lists them again after the database dump (`objects.ts`'s `collectArchivedObjects`), so the
// scheduled path, which shows nothing, never pays for this listing.
async function listObjectTotals(): Promise<ListedObjectTotals> {
  const { storage } = await import("@/lib/storage/s3")
  const { objects, unarchivableObjectCount } = await listArchivedObjects(storage)

  return { totals: totalArchivedObjects(objects), unarchivableObjectCount }
}

// Counted, never named: a public key is the only thing between its object and an anonymous reader.
function warnAboutUnarchivableObjects(count: number): void {
  if (count === 0) return

  p.log.warn(
    `${count} object(s) in the storage buckets were left out: their keys are not ones Remit writes and a backup archive cannot hold them. Remit's buckets should hold nothing else.`
  )
}

function formatPlan(plan: BackupPlan, objectTotals: ObjectTotals): string {
  return [
    `${chalk.bold("Destination")}: ${plan.destination}`,
    `${chalk.bold("Archive")}: ${plan.archiveUri}`,
    `${chalk.bold("Stored files (public)")}: ${objectTotals.public.fileCount} files, ${formatBytes(objectTotals.public.totalSize)}`,
    `${chalk.bold("Stored files (documents)")}: ${objectTotals.documents.fileCount} files, ${formatBytes(objectTotals.documents.totalSize)}`,
    "",
    chalk.bold("Tables"),
    ...plan.tableNames.map((table) => `  ${table}`)
  ].join("\n")
}

export function formatBackupError(error: unknown): string {
  if (error instanceof BackupCliError) return error.message

  return (
    redactBackupReason(error) ||
    "Backup failed. Run pnpm services:up first and confirm database and filesystem access."
  )
}
