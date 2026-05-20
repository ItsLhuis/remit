import { randomUUID } from "node:crypto"

import { createReadStream } from "node:fs"
import { rm } from "node:fs/promises"

import { createRequire } from "node:module"

import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import { spawn } from "node:child_process"

import { pipeline } from "node:stream/promises"

import * as p from "@clack/prompts"

import chalk from "chalk"

import { sql } from "drizzle-orm"

import pkg from "@/package.json"

import {
  RestoreCliError,
  applyUploadsAtomicSwap,
  getDatabaseName,
  readAndValidateRestoreHeader,
  redactRestoreReason,
  verifyArchivePayload,
  type RestoreManifest
} from "./_lib/restore-archive"
import { formatBytes } from "./_lib/format"
import { waitForProcess } from "./_lib/process"

import { resolveLocalUploadsDirectory } from "@/lib/storage/local"

const require = createRequire(import.meta.url)

const { loadEnvConfig } = require("@next/env") as typeof import("@next/env")

loadEnvConfig(process.cwd())

type Database = typeof import("@/database").database
type DatabaseClient = typeof import("@/database").client
type Schema = typeof import("@/database/schema")

type RestoreCliOptions = {
  backupFile: string
  dryRun: boolean
  help: boolean
  yes: boolean
}

type ParseResult = { data: RestoreCliOptions } | { error: string }

type RestoreAuditEvent =
  | "instance.restore.started"
  | "instance.restore.snapshot_taken"
  | "instance.restore.completed"
  | "instance.restore.aborted"

type RestoreAuditRecord = {
  event: RestoreAuditEvent
  metadata: Record<string, unknown>
}

type RestoreRuntimeState = {
  auditTrail: RestoreAuditRecord[]
  client: DatabaseClient | null
  database: Database | null
  databaseApplied: boolean
  schema: Schema | null
  snapshotPath: string | null
  stagedUploadsDir: string | null
  workDir: string | null
}

const CLI_USER_AGENT = "cli/restore"

async function main(): Promise<void> {
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
  const archivePath = path.resolve(parsed.data.backupFile)

  try {
    const { env } = await import("@/lib/config/env")

    const encryptionKey = Buffer.from(env.REMIT_ENCRYPTION_KEY, "base64")
    const remitDataDir = path.resolve(env.REMIT_DATA_DIR)
    const timestamp = formatArchiveTimestamp(new Date())
    const liveUploadsDir = resolveLocalUploadsDirectory(remitDataDir)
    const uploadsBaseName = path.basename(liveUploadsDir)
    const stagingToken = `${timestamp}-${randomUUID()}`

    state.workDir = path.join(remitDataDir, `.restore-work-${stagingToken}`)
    state.stagedUploadsDir = path.join(
      path.dirname(liveUploadsDir),
      `.${uploadsBaseName}.restore-staging-${stagingToken}`
    )

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
          archivePath,
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

    const [{ database, client }, schema] = await Promise.all([
      import("@/database"),
      import("@/database/schema")
    ])

    state.database = database
    state.client = client
    state.schema = schema

    await writeRestoreAudit(state, "instance.restore.started", {
      operationId,
      archiveAppVersion: verified.manifest.appVersion,
      archivePath,
      schemaMigrationId: verified.manifest.schemaMigrationId
    })

    state.snapshotPath = buildPreRestoreSnapshotPath(remitDataDir, timestamp)
    await takePreRestoreSnapshot(database, schema, {
      databaseUrl: env.DATABASE_URL,
      encryptionKey,
      outputPath: state.snapshotPath,
      remitDataDir
    })

    p.note(state.snapshotPath, "Pre-restore snapshot")

    await writeRestoreAudit(state, "instance.restore.snapshot_taken", {
      operationId,
      archivePath,
      snapshotPath: state.snapshotPath
    })

    await confirmDestructiveRestore({
      // Read directly from process.env rather than lib/config/env: this is an operator-set runtime
      // control flag for unattended restores, not part of the validated production app config.
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
      archivePath,
      snapshotPath: state.snapshotPath
    })

    p.outro("Restore complete.")
    process.exit(0)
  } catch (error) {
    p.cancel("Restore failed.")
    console.error(formatErrorForCli(error))

    await writeAbortAuditIfAllowed(state, error, {
      archivePath,
      operationId,
      parsed: parsed.data
    })

    process.exit(1)
  } finally {
    await cleanupRuntimeState(state)
  }
}

function parseRestoreArgs(args: string[]): ParseResult {
  const options: RestoreCliOptions = {
    backupFile: "",
    dryRun: false,
    help: false,
    yes: false
  }

  for (const arg of args) {
    if (arg === "--dry-run") {
      options.dryRun = true
      continue
    }

    if (arg === "--help") {
      options.help = true
      continue
    }

    if (arg === "--yes") {
      options.yes = true
      continue
    }

    if (arg.startsWith("--")) {
      return { error: `Unknown option: ${arg}` }
    }

    if (options.backupFile) {
      return { error: "Only one <backup-file> argument is supported." }
    }

    options.backupFile = arg
  }

  if (!options.help && !options.backupFile) {
    return { error: "<backup-file> is required." }
  }

  return { data: options }
}

async function takePreRestoreSnapshot(
  database: Database,
  schema: Schema,
  options: {
    databaseUrl: string
    encryptionKey: Buffer
    outputPath: string
    remitDataDir: string
  }
): Promise<void> {
  const { runBackup } = await import("./backup")

  await runBackup(database, schema, {
    databaseUrl: options.databaseUrl,
    destinationOverride: "local",
    dryRun: false,
    encryptionKey: options.encryptionKey,
    help: false,
    output: options.outputPath,
    remitDataDir: options.remitDataDir,
    skipStatusUpdate: true,
    yes: true
  })
}

async function confirmDestructiveRestore(input: {
  allowUnattended: boolean
  databaseName: string
  snapshotPath: string
  yes: boolean
}): Promise<void> {
  if (input.yes) {
    if (input.allowUnattended) return

    throw new RestoreCliError(
      "Refusing restore: --yes requires REMIT_ALLOW_UNATTENDED_RESTORE=1. Set both for unattended restore, or rerun without --yes and complete the typed confirmations.",
      "unattended-restore-not-allowed"
    )
  }

  const databaseConfirmation = await p.text({
    message: `Type the database name to restore into (${input.databaseName})`,
    validate(value) {
      return value === input.databaseName ? undefined : "Database name must match exactly."
    }
  })

  exitOnCancel(databaseConfirmation)

  const snapshotConfirmation = await p.text({
    message: "Type the pre-restore snapshot path",
    validate(value) {
      return value === input.snapshotPath ? undefined : "Snapshot path must match exactly."
    }
  })

  exitOnCancel(snapshotConfirmation)
}

async function restoreDatabaseDump(databaseDumpPath: string, databaseUrl: string): Promise<void> {
  const args = [
    "--clean",
    "--if-exists",
    "--no-owner",
    "--no-privileges",
    "--single-transaction",
    "--dbname",
    databaseUrl
  ]
  // shell mode on Windows lets PATHEXT resolve pg_restore.exe or a pg_restore.cmd shim; arguments
  // are passed as an array so the shell never receives unescaped input. This matches how
  // dumpDatabaseToTempFile spawns pg_dump in backup.ts.
  const child = spawn("pg_restore", args, {
    env: {
      ...process.env,
      PG_COLOR: "never"
    },
    shell: process.platform === "win32",
    stdio: ["pipe", "ignore", "pipe"]
  })
  let stderr = ""

  child.stderr.setEncoding("utf8")
  child.stderr.on("data", (chunk: string) => {
    stderr = `${stderr}${chunk}`.slice(-4000)
  })

  const pipeResult = pipeline(createReadStream(databaseDumpPath), child.stdin).catch(
    (error: unknown) => error
  )
  const exitCode = await waitForProcess(child)
  const pipeError = await pipeResult

  if (exitCode !== 0) {
    throw new RestoreCliError(
      `pg_restore failed. Database changes were not committed because --single-transaction is enabled. ${redactRestoreReason(stderr)}`,
      "pg-restore-failed"
    )
  }

  if (pipeError instanceof Error) {
    throw new RestoreCliError(
      "pg_restore input stream failed before the database restore completed.",
      "pg-restore-input-failed"
    )
  }
}

async function runPostRestoreMigrations(databaseUrl: string): Promise<void> {
  // Resolve migrate.js relative to this compiled module rather than process.cwd(). Both restore.js
  // and migrate.js are emitted as siblings in scripts/dist by tsup, so this is correct regardless of
  // the working directory the operator invokes the command from.
  const migrateScript = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrate.js")
  const child = spawn(process.execPath, [migrateScript], {
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl
    },
    stdio: ["ignore", "pipe", "pipe"]
  })
  let output = ""

  child.stdout.setEncoding("utf8")
  child.stderr.setEncoding("utf8")
  child.stdout.on("data", (chunk: string) => {
    output = `${output}${chunk}`.slice(-4000)
  })
  child.stderr.on("data", (chunk: string) => {
    output = `${output}${chunk}`.slice(-4000)
  })

  const exitCode = await waitForProcess(child)

  if (exitCode !== 0) {
    throw new RestoreCliError(
      `Post-restore migrations failed. ${redactRestoreReason(output)}`,
      "post-restore-migrations-failed"
    )
  }
}

async function writeRestoreAudit(
  state: RestoreRuntimeState,
  event: RestoreAuditEvent,
  metadata: Record<string, unknown>
): Promise<void> {
  if (!state.database || !state.schema) {
    throw new RestoreCliError(
      "Restore audit database is not available.",
      "restore-audit-unavailable"
    )
  }

  const record = {
    event,
    metadata
  }

  if (event !== "instance.restore.completed" && event !== "instance.restore.aborted") {
    state.auditTrail.push(record)
  }

  await state.database.insert(state.schema.auditLogs).values({
    event,
    actorUserId: null,
    actorRole: null,
    targetEntityType: "instance",
    targetEntityId: null,
    metadata,
    ipAddress: null,
    userAgent: CLI_USER_AGENT
  })
}

async function replayPreRestoreAuditTrail(state: RestoreRuntimeState): Promise<void> {
  if (!state.databaseApplied || !state.database || !state.schema) return
  if (state.auditTrail.length === 0) return

  // The restored dump replaced the live database, so the pre-restore audit rows are gone. In the
  // success path forward migrations have already (re)created audit_logs, but on the abort path the
  // replay can run before migrations against an older dump that predates the table. Skip the replay
  // with a clear warning instead of failing on a missing-table insert.
  if (!(await auditLogsTableExists(state.database))) {
    console.warn(
      "Restored database has no audit_logs table; skipping pre-restore audit replay. Forward migrations will create it on the next start."
    )
    state.auditTrail = []
    return
  }

  for (const record of state.auditTrail) {
    await state.database.insert(state.schema.auditLogs).values({
      event: record.event,
      actorUserId: null,
      actorRole: null,
      targetEntityType: "instance",
      targetEntityId: null,
      metadata: {
        ...record.metadata,
        replayedAfterDatabaseRestore: true
      },
      ipAddress: null,
      userAgent: CLI_USER_AGENT
    })
  }

  state.auditTrail = []
}

async function auditLogsTableExists(database: Database): Promise<boolean> {
  const rows = await database.execute(sql`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'audit_logs'
    ) AS exists
  `)
  const [row] = Array.from(rows as Iterable<{ exists: boolean }>)

  return Boolean(row?.exists)
}

async function writeAbortAuditIfAllowed(
  state: RestoreRuntimeState,
  error: unknown,
  input: {
    archivePath: string
    operationId: string
    parsed: RestoreCliOptions
  }
): Promise<void> {
  if (input.parsed.dryRun) return
  if (error instanceof RestoreCliError && !error.auditEligible) return

  try {
    if (!state.database || !state.schema) {
      const [{ database, client }, schema] = await Promise.all([
        import("@/database"),
        import("@/database/schema")
      ])
      state.database = database
      state.client = client
      state.schema = schema
    }

    await replayPreRestoreAuditTrail(state)
    await writeRestoreAudit(state, "instance.restore.aborted", {
      operationId: input.operationId,
      archivePath: input.archivePath,
      reason: redactRestoreReason(error),
      snapshotPath: state.snapshotPath
    })
  } catch (auditError) {
    // Preserve the original restore failure as the actionable operator-facing message, but surface
    // the secondary audit failure so the lost operational visibility is not entirely silent.
    console.error(`Failed to write restore abort audit entry: ${redactRestoreReason(auditError)}`)
  }
}

async function cleanupRuntimeState(state: RestoreRuntimeState): Promise<void> {
  await Promise.all([
    state.workDir ? rm(state.workDir, { recursive: true, force: true }) : Promise.resolve(),
    state.stagedUploadsDir
      ? rm(state.stagedUploadsDir, { recursive: true, force: true })
      : Promise.resolve()
  ])

  if (state.client) {
    await state.client.end()
  }
}

function buildPreRestoreSnapshotPath(remitDataDir: string, timestamp: string): string {
  return path.join(
    remitDataDir,
    "backups",
    `remit-backup-${timestamp}-v${pkg.version}.pre-restore.remitbak`
  )
}

function formatArchiveTimestamp(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z")
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

function getRestoreHelpText(): string {
  const command = chalk.bold("pnpm remit:restore")
  const option = (value: string) => chalk.cyan(value)
  const heading = (value: string) => chalk.bold(value)
  const optionLine = (flag: string, description: string) =>
    `  ${option(flag.padEnd(12))} ${description}`

  return [
    heading("Usage"),
    `  ${command} ${option("<backup-file>")} ${option("[--dry-run]")} ${option("[--yes]")} ${option("[--help]")}`,
    "",
    heading("Purpose"),
    "  Validate, decrypt, and restore a local .remitbak archive produced by pnpm remit:backup.",
    "",
    heading("Options"),
    optionLine(
      "--dry-run",
      "Verify the archive and print what would change without writing anything."
    ),
    optionLine(
      "--yes",
      "Skip typed confirmations only when REMIT_ALLOW_UNATTENDED_RESTORE=1 is also set."
    ),
    optionLine("--help", "Print this help text."),
    "",
    heading("Safety"),
    "  Restore always takes a local pre-restore snapshot before destructive work, applies the database with pg_restore --single-transaction, and swaps uploads atomically.",
    "",
    heading("Deferred"),
    "  Remote restore, partial restore, point-in-time restore, and --force-version are not implemented."
  ].join("\n")
}

function formatErrorForCli(error: unknown): string {
  if (error instanceof RestoreCliError) {
    return error.message
  }

  return (
    redactRestoreReason(error) ||
    "Restore failed. Confirm the archive path, database reachability, and filesystem permissions."
  )
}

function exitOnCancel<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    p.cancel("Restore cancelled. No restore was applied.")
    process.exit(0)
  }

  return value
}

function isDirectRun(): boolean {
  const scriptPath = process.argv[1]

  return Boolean(scriptPath) && import.meta.url === pathToFileURL(scriptPath).href
}

if (isDirectRun()) {
  main()
}
