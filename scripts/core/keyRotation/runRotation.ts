import { randomUUID } from "node:crypto"
import path from "node:path"

import * as p from "@clack/prompts"

import chalk from "chalk"

import type postgres from "postgres"

import pkg from "@/package.json"

import { buildPreRotationBackupPath } from "../backup/filename"
import { runBackup } from "../backup/runBackup"
import { decryptValue, encryptValue } from "../encryption/values"
import { readAndValidateRestoreHeader } from "../restore/header"
import { verifyArchivePayload } from "../restore/verifyArchive"
import { formatBytes } from "../utils/format"

import { listArchivePlans, reencryptConfiguredArchives, type ArchivePlan } from "./archives"
import { type RotateCliOptions } from "./args"
import { writeRotationAudit } from "./audit"
import { groupEncryptedColumns, type EncryptedTable } from "./columns"
import { RotationCliError } from "./errors"
import { acquireRotationLock, releaseRotationLock } from "./lock"
import {
  resolveRotationProgress,
  type RotationAuditEvent,
  type RotationAuditRecord
} from "./progress"
import { validateRuntimeKeys } from "./readKeys"
import { redactRotationReason } from "./redact"
import { rotateEncryptedTables, type TableRotationResult } from "./rotateTables"
import { verifyOldKeyMatchesInstance } from "./verifyOldKey"

type Database = typeof import("@/database").database
type Schema = typeof import("@/database/schema")

type ReservedSql = postgres.ReservedSql
type Sql = postgres.Sql

export type { RotateCliOptions }

export type RotationRuntimeOptions = RotateCliOptions & {
  currentEnvKey: Buffer
  databaseUrl: string
  newKey: Buffer
  oldKey: Buffer
  remitDataDir: string
}

type RotationState = {
  client: Sql | null
  lock: ReservedSql | null
  operationId: string | null
}

export async function runKeyRotation(
  database: Database,
  client: Sql,
  schema: Schema,
  options: RotationRuntimeOptions
): Promise<void> {
  const state: RotationState = {
    client,
    lock: null,
    operationId: null
  }
  const encryptedColumns = schema.getEncryptedColumns()
  const tables = groupEncryptedColumns(encryptedColumns)

  validateRuntimeKeys(options)

  state.lock = await acquireRotationLock(client)

  try {
    const existingProgress = await loadRotationProgress(client)

    if (!options.dryRun && !options.resume && existingProgress.ok) {
      throw new RotationCliError(
        "Refusing rotation: a previous key rotation audit trail is incomplete. Re-run with --resume to continue from the last completed table."
      )
    }

    if (options.resume && !existingProgress.ok) {
      throw new RotationCliError(`Refusing resume: ${existingProgress.reason}`)
    }

    await verifyOldKeyMatchesInstance(
      client,
      tables.filter(
        (table) =>
          !options.resume ||
          !existingProgress.ok ||
          !existingProgress.completedTables.has(table.table)
      ),
      options
    )

    if (options.dryRun) {
      await runDryRun(client, options, tables)
      return
    }

    let operationId: string = randomUUID()
    let completedTables = new Set<string>()
    let backupPath: string

    if (options.resume) {
      if (!existingProgress.ok) {
        throw new RotationCliError(`Refusing resume: ${existingProgress.reason}`)
      }

      operationId = existingProgress.operationId
      completedTables = existingProgress.completedTables
      backupPath = await readStartedBackupPath(client, operationId)
      state.operationId = operationId
    } else {
      state.operationId = operationId

      await releaseRotationLock(state.lock)

      state.lock = null
      backupPath = await ensurePreRotationBackup(database, schema, options)
      state.lock = await acquireRotationLock(client)

      await verifyOldKeyMatchesInstance(client, tables, options)

      await writeRotationAudit(client, "instance.key_rotation.started", {
        operationId,
        backupPath,
        encryptedTables: tables.map((table) => table.table),
        encryptedColumns: encryptedColumns.map(({ table, column }) => `${table}.${column}`)
      })
    }

    const tableResults = await rotateEncryptedTables(client, tables, {
      completedTables,
      newKey: options.newKey,
      oldKey: options.oldKey,
      operationId
    })

    const archiveResults = await reencryptConfiguredArchives(client, options, operationId)

    await writeRotationAudit(client, "instance.key_rotation.completed", {
      operationId,
      backupPath,
      archiveFailures: archiveResults.failures,
      archivesReencrypted: archiveResults.reencrypted,
      tables: tableResults.map((table) => ({
        encryptedValuesRotated: table.encryptedValuesRotated,
        rowsScanned: table.rowsScanned,
        table: table.table
      }))
    })

    printSuccessSummary({ archiveResults, tableResults })
  } catch (error) {
    if (!options.dryRun && state.operationId) {
      await writeRotationAudit(client, "instance.key_rotation.aborted", {
        operationId: state.operationId,
        reason: redactRotationReason(error)
      }).catch(() => undefined)
    }
    throw error
  } finally {
    await releaseRotationLock(state.lock)

    state.lock = null
  }
}

async function ensurePreRotationBackup(
  database: Database,
  schema: Schema,
  options: RotationRuntimeOptions
): Promise<string> {
  if (options.backupFile) {
    const backupPath = path.resolve(options.backupFile)
    const header = await readAndValidateRestoreHeader(backupPath, options.oldKey)

    await verifyArchivePayload({
      archivePath: backupPath,
      currentAppVersion: pkg.version,
      encryptionKey: options.oldKey,
      header,
      mode: "verify-only"
    })

    return backupPath
  }

  const outputPath = buildPreRotationBackupPath(options.remitDataDir, new Date())

  await runBackup(database, schema, {
    databaseUrl: options.databaseUrl,
    destinationOverride: "local",
    dryRun: false,
    encryptionKey: options.oldKey,
    help: false,
    output: outputPath,
    remitDataDir: options.remitDataDir,
    skipStatusUpdate: true,
    yes: true
  })

  return outputPath
}

async function runDryRun(
  client: Sql,
  options: RotationRuntimeOptions,
  tables: readonly EncryptedTable[]
): Promise<void> {
  const tableSummaries = await Promise.all(
    tables.map(async (table) => {
      const rowCount = await countRows(client, table.table)
      const verified = await verifyTableRoundTrip(client, table, options)
      return { table: table.table, rowCount, verified }
    })
  )
  const archivePlans = await listArchivePlans(client, options, options.oldKey)

  p.note(
    [
      chalk.bold("Encrypted tables"),
      ...tableSummaries.map(
        (summary) =>
          `  ${summary.table}: ${summary.rowCount} rows; ${summary.verified ? "round-trip verified" : "no encrypted value to sample"}`
      ),
      "",
      chalk.bold("Backup archives"),
      ...(archivePlans.length === 0
        ? ["  No .remitbak archives found."]
        : archivePlans.map((archive) => {
            const descriptor =
              archive.destination === "local"
                ? archive.path
                : `remit://${archive.destination}/${archive.key}`

            return `  ${descriptor} (${formatBytes(archive.size)})`
          }))
    ].join("\n"),
    "Dry run"
  )

  p.outro("Dry run complete. No backup, audit entry, database update, or archive rewrite was made.")
}

async function verifyTableRoundTrip(
  client: Sql,
  table: EncryptedTable,
  options: { newKey: Buffer; oldKey: Buffer }
): Promise<boolean> {
  for (const column of table.columns) {
    const rows = await client<Array<Record<string, unknown>>>`
      SELECT ${client(column)}
      FROM ${client(table.table)}
      WHERE ${client(column)} IS NOT NULL
      LIMIT 1
    `
    const row = rows[0]
    const value = row ? row[column] : null
    if (typeof value !== "string" || !value) continue

    const plaintext = decryptValue(value, options.oldKey)
    const reencrypted = encryptValue(plaintext, options.newKey)

    if (decryptValue(reencrypted, options.newKey) !== plaintext) {
      throw new RotationCliError(
        `Round-trip verification failed for ${table.table}.${column}; rotation was not started.`
      )
    }

    return true
  }

  return false
}

async function countRows(client: Sql, table: string): Promise<number> {
  const [row] = await client<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS count
    FROM ${client(table)}
  `

  return row?.count ?? 0
}

async function loadRotationProgress(client: Sql) {
  const rows = await client<
    Array<{ created_at: Date | string; event: RotationAuditEvent; metadata: unknown }>
  >`
    SELECT event, metadata, created_at
    FROM audit_logs
    WHERE event LIKE 'instance.key_rotation.%'
    ORDER BY created_at ASC
  `
  const records: RotationAuditRecord[] = rows.map((row) => ({
    event: row.event,
    createdAt: readAuditCreatedAt(row.created_at),
    metadata: row.metadata
  }))

  return resolveRotationProgress(records)
}

function readAuditCreatedAt(value: Date | string): Date {
  const createdAt = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(createdAt.getTime())) {
    throw new RotationCliError("Key rotation audit trail contains an invalid created_at timestamp.")
  }

  return createdAt
}

async function readStartedBackupPath(client: Sql, operationId: string): Promise<string> {
  const [row] = await client<Array<{ metadata: unknown }>>`
    SELECT metadata
    FROM audit_logs
    WHERE event = 'instance.key_rotation.started'
    ORDER BY created_at DESC
    LIMIT 1
  `
  const metadata = row?.metadata

  if (!metadataMatchesOperation(metadata, operationId)) {
    throw new RotationCliError(
      "Refusing resume: latest key rotation start marker does not match the resume operation."
    )
  }

  const backupPath = readMetadataString(metadata, "backupPath")

  if (!backupPath) {
    throw new RotationCliError(
      "Refusing resume: key rotation audit trail is missing the pre-rotation backup path."
    )
  }

  return backupPath
}

function metadataMatchesOperation(metadata: unknown, operationId: string): boolean {
  return readMetadataString(metadata, "operationId") === operationId
}

function readMetadataString(metadata: unknown, key: string): string | null {
  if (typeof metadata !== "object" || metadata === null || !(key in metadata)) return null

  const value = (metadata as Record<string, unknown>)[key]

  return typeof value === "string" && value.length > 0 ? value : null
}

function printSuccessSummary(input: {
  archiveResults: { failures: number; reencrypted: number }
  tableResults: Array<TableRotationResult & { table: string }>
}): void {
  p.note(
    [
      chalk.bold("Database tables"),
      ...input.tableResults.map(
        (table) =>
          `  ${table.table}: ${table.rowsScanned} rows scanned, ${table.encryptedValuesRotated} encrypted values rotated`
      ),
      "",
      chalk.bold("Backup archives"),
      `  Re-encrypted: ${input.archiveResults.reencrypted}`,
      `  Failed: ${input.archiveResults.failures}`
    ].join("\n"),
    "Rotation summary"
  )

  p.note(
    [
      "Set REMIT_ENCRYPTION_KEY to the new key you provided for this rotation.",
      "Restart the app stack after updating the deployment environment.",
      "Example: docker compose up -d --force-recreate app"
    ].join("\n"),
    "Operator post-run steps"
  )
  p.outro("Encryption key rotation complete.")
}

export function formatRotationError(error: unknown): string {
  if (error instanceof RotationCliError) return error.message

  return (
    redactRotationReason(error) ||
    "Encryption key rotation failed. Verify database reachability, backup access, and the provided keys."
  )
}

export async function writeAbortAuditIfPossible(
  client: Sql | null,
  operationId: string | null,
  error: unknown
): Promise<void> {
  if (!client || !operationId) return

  try {
    await writeRotationAudit(client, "instance.key_rotation.aborted", {
      operationId,
      reason: redactRotationReason(error)
    })
  } catch {
    // Preserve original rotation failure as actionable operator-facing message.
  }
}

export { type ArchivePlan }
