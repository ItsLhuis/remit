import { randomUUID } from "node:crypto"
import path from "node:path"

import * as p from "@clack/prompts"

import chalk from "chalk"

import type postgres from "postgres"

import {
  acquireBackupLock,
  findBackupLockHolder,
  releaseBackupLock
} from "@/lib/backups/backupLock"
import { describeBackupLockHolder } from "@/lib/backups/backupLockHolder"

import pkg from "@/package.json"

import { buildPreRotationBackupPath } from "../backup/filename"
import { runBackup } from "../backup/runBackup"
import { readAndValidateRestoreHeader } from "../restore/header"
import { verifyArchivePayload } from "../restore/verifyArchive"

import { reencryptConfiguredArchives, type ArchivePlan } from "./archives"
import { type RotateCliOptions } from "./args"
import { writeRotationAudit } from "./audit"
import { groupEncryptedColumns } from "./columns"
import { runDryRun } from "./dryRun"
import { RotationCliError } from "./errors"
import { acquireRotationLock, releaseRotationLock } from "./lock"
import { loadRotationProgress, readStartedBackupPath } from "./progressTrail"
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
  backupLock: ReservedSql | null
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
    backupLock: null,
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

    // Held for the whole rotation, the way a restore holds it (`lib/backups/backupLock.ts`): the
    // pre-rotation backup runs under it without taking it, and no other backup can write or prune an
    // archive while this run re-encrypts them — an archive uploaded after that pass has listed the
    // destination stays readable only by the retired key. It also covers the moment below when the
    // rotation lock is dropped for the pre-rotation backup.
    state.backupLock = await acquireBackupLock(client, "key-rotation")

    if (!state.backupLock) {
      const holder = describeBackupLockHolder(await findBackupLockHolder(client))

      throw new RotationCliError(
        `Refusing rotation: ${holder} holds the backup lock. Run the rotation again once it has finished.`
      )
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
    await releaseBackupLock(state.backupLock)
    await releaseRotationLock(state.lock)

    state.backupLock = null
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
    // Swallowed so the original rotation failure stays the message the operator acts on; a
    // secondary audit-write failure must not replace it.
  }
}

export { type ArchivePlan }
