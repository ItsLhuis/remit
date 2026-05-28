import { randomUUID } from "node:crypto"

import path from "node:path"

import { sql } from "drizzle-orm"

import { buildBackupFilename, buildRemoteBackupKey, DEFAULT_BACKUP_DIRNAME } from "./filename"

import { listLocalStorageObjects, resolveLocalUploadsDirectory } from "@/lib/storage/local"
import type { LocalStorageObject } from "@/lib/storage/local"

import type { BackupDestination } from "../destination"
import type { BackupCliOptions } from "./args"

import pkg from "@/package.json"
import migrationJournal from "@/drizzle/migrations/meta/_journal.json"

type Database = typeof import("@/database").database
type SettingsRow = Awaited<ReturnType<Database["query"]["settings"]["findFirst"]>>

export type BackupPlan = {
  archiveFilename: string
  archiveUri: string
  destination: BackupDestination
  objectKey: string | null
  outputPath: string
  retentionPolicy: { daily: number; monthly: number; weekly: number }
  tableNames: string[]
  uploads: LocalStorageObject[]
  uploadsDirectory: string
  uploadsTotalSize: number
}

export class BackupPlanError extends Error {}

export async function buildBackupPlan(
  database: Database,
  destination: BackupDestination,
  settingsRow: SettingsRow,
  options: BackupCliOptions & { remitDataDir: string }
): Promise<BackupPlan> {
  if (destination !== "local" && options.output) {
    throw new BackupPlanError(
      "--output writes a local archive path and cannot be combined with a remote backup destination. Use --destination local or remove --output."
    )
  }

  const dataDir = path.resolve(options.remitDataDir)
  const createdAt = new Date()
  const archiveFilename = buildBackupFilename(createdAt, pkg.version)
  const backupsDir = path.resolve(dataDir, DEFAULT_BACKUP_DIRNAME)
  const objectKey =
    destination === "local" ? null : buildRemoteBackupKey(createdAt, archiveFilename)
  const outputPath =
    destination === "local"
      ? path.resolve(options.output ?? path.join(backupsDir, archiveFilename))
      : path.join(backupsDir, ".tmp", `${archiveFilename}.${randomUUID()}.upload`)
  const uploadsDirectory = resolveLocalUploadsDirectory(dataDir)
  const [tableNames, uploads] = await Promise.all([
    listDatabaseTables(database),
    listLocalStorageObjects({ rootDir: uploadsDirectory, skipDir: backupsDir })
  ])
  const uploadsTotalSize = uploads.reduce((sum, upload) => sum + upload.size, 0)

  return {
    archiveFilename,
    archiveUri: objectKey ? `remit://${destination}/${objectKey}` : outputPath,
    destination,
    objectKey,
    outputPath,
    retentionPolicy: {
      daily: settingsRow?.backupRetentionDaily ?? 7,
      monthly: settingsRow?.backupRetentionMonthly ?? 12,
      weekly: settingsRow?.backupRetentionWeekly ?? 4
    },
    tableNames,
    uploads,
    uploadsDirectory,
    uploadsTotalSize
  }
}

async function listDatabaseTables(database: Database): Promise<string[]> {
  const rows = await database.execute(sql`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> 'drizzle_migrations'
    ORDER BY tablename
  `)

  return Array.from(rows as Iterable<{ tablename: string }>).map((row) => row.tablename)
}

// Reads the count of applied migrations from drizzle.__drizzle_migrations and maps
// it back to a human-readable tag via the migration journal. The table is a
// Drizzle internal; if absent or empty the manifest records "none" rather than
// failing the backup.
export async function getLatestAppliedMigrationId(database: Database): Promise<string> {
  const migrationTableRows = await database.execute(sql`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'drizzle'
        AND table_name = '__drizzle_migrations'
    ) AS exists
  `)
  const [migrationTableRow] = Array.from(migrationTableRows as Iterable<{ exists: boolean }>)

  if (!migrationTableRow?.exists) return "none"

  const rows = await database.execute(sql`
    SELECT COUNT(*)::int AS count
    FROM drizzle.__drizzle_migrations
  `)
  const [row] = Array.from(rows as Iterable<{ count: number }>)
  const appliedCount = row?.count ?? 0

  if (appliedCount <= 0) return "none"

  const entry = migrationJournal.entries[appliedCount - 1] ?? migrationJournal.entries.at(-1)

  return entry?.tag ?? "none"
}
