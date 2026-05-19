import { createHash, randomBytes, randomUUID } from "node:crypto"

import { createReadStream, createWriteStream } from "node:fs"
import { mkdir, rename, rm, stat } from "node:fs/promises"

import { createRequire } from "node:module"

import path from "node:path"
import { pathToFileURL } from "node:url"
import { createGzip } from "node:zlib"

import { spawn } from "node:child_process"

import { once } from "node:events"

import type { Readable, Writable } from "node:stream"
import { finished } from "node:stream/promises"

import * as p from "@clack/prompts"

import chalk from "chalk"

import { eq, sql } from "drizzle-orm"

import pkg from "@/package.json"

import migrationJournal from "@/drizzle/migrations/meta/_journal.json"

import {
  ARCHIVE_HEADER_LENGTH,
  computeKeyFingerprint,
  encryptStream,
  writeArchiveHeader
} from "./_lib/backup-archive"
import {
  buildBackupManifest,
  serializeBackupManifest,
  sha256Hex,
  type BackupDestination
} from "./_lib/backup-manifest"

import {
  createLocalStorageReadStream,
  listLocalStorageObjects,
  resolveLocalUploadsDirectory,
  type LocalStorageObject
} from "@/lib/storage/local"

const require = createRequire(import.meta.url)

const { loadEnvConfig } = require("@next/env") as typeof import("@next/env")

loadEnvConfig(process.cwd())

type Database = typeof import("@/database").database
type Schema = typeof import("@/database/schema")

type BackupCliOptions = {
  dryRun: boolean
  help: boolean
  output: string | null
  yes: boolean
}

type ParseResult = { data: BackupCliOptions } | { error: string }

type BackupPlan = {
  destination: BackupDestination
  outputPath: string
  tableNames: string[]
  uploads: LocalStorageObject[]
  uploadsDirectory: string
  uploadsTotalSize: number
}

type DatabaseDumpDescriptor = {
  path: string
  sha256: string
  size: number
}

type UploadDescriptor = LocalStorageObject & {
  archivePath: string
  sha256: string
}

type BackupResult = {
  archivePath: string
  manifest: ReturnType<typeof buildBackupManifest>
  wrote: boolean
}

class BackupCliError extends Error {}

const DEFAULT_BACKUP_DIRNAME = "backups"
const TAR_BLOCK_SIZE = 512

async function main(): Promise<void> {
  const parsed = parseBackupArgs(process.argv.slice(2))

  if ("error" in parsed) {
    console.error(parsed.error)
    console.log("")
    console.log(getBackupHelpText())
    process.exit(1)
  }

  if (parsed.data.help) {
    console.log(getBackupHelpText())
    process.exit(0)
  }

  p.intro("Remit backup")

  const [{ database, client }, schema, { env }] = await Promise.all([
    import("@/database"),
    import("@/database/schema"),
    import("@/lib/config/env")
  ])

  try {
    const result = await runBackup(database, schema, {
      ...parsed.data,
      databaseUrl: env.DATABASE_URL,
      encryptionKey: Buffer.from(env.REMIT_ENCRYPTION_KEY, "base64"),
      remitDataDir: env.REMIT_DATA_DIR
    })

    if (result.wrote) {
      p.outro(`Backup complete.\n${result.archivePath}`)
    } else {
      p.outro("Dry run complete. No archive was written.")
    }

    process.exit(0)
  } catch (error) {
    p.cancel("Backup failed.")
    console.error(formatErrorForCli(error))
    process.exit(1)
  } finally {
    await client.end()
  }
}

export async function runBackup(
  database: Database,
  schema: Schema,
  options: BackupCliOptions & {
    databaseUrl: string
    encryptionKey: Buffer
    remitDataDir: string
  }
): Promise<BackupResult> {
  const planSpinner = p.spinner()
  let planSpinnerActive = true

  planSpinner.start("Building backup plan...")

  let settingsRow: Awaited<ReturnType<Database["query"]["settings"]["findFirst"]>> | undefined

  try {
    settingsRow = await database.query.settings.findFirst()

    const plan = await buildBackupPlan(database, settingsRow?.backupDestination ?? "local", options)

    planSpinner.stop("Backup plan ready.")
    planSpinnerActive = false

    p.note(formatPlan(plan), options.dryRun ? "Dry run" : "Plan")

    if (plan.destination !== "local") {
      throw new BackupCliError(
        `Backup destination "${plan.destination}" is configured, but only local backups are implemented in this pass. Remote destinations land in Prompt 04.`
      )
    }

    if (options.dryRun) {
      return {
        archivePath: plan.outputPath,
        manifest: buildBackupManifest({
          appVersion: pkg.version,
          checksumsSha256: "0".repeat(64),
          components: {
            database: { size: 0, sha256: "0".repeat(64) },
            uploads: { fileCount: plan.uploads.length, totalSize: plan.uploadsTotalSize }
          },
          createdAt: new Date().toISOString(),
          destination: "local",
          encryptionKey: options.encryptionKey,
          schemaMigrationId: await getLatestAppliedMigrationId(database)
        }),
        wrote: false
      }
    }

    await confirmOverwrite(plan.outputPath, options.yes)

    const archiveSpinner = p.spinner()
    archiveSpinner.start("Writing encrypted backup archive...")

    try {
      const result = await writeLocalBackupArchive(database, plan, options)

      await updateBackupSuccess(database, schema, settingsRow?.id ?? null)
      archiveSpinner.stop("Encrypted archive written.")

      return result
    } catch (error) {
      archiveSpinner.stop("Archive write failed.")
      throw error
    }
  } catch (error) {
    if (planSpinnerActive) {
      planSpinner.stop("Backup plan failed.")
    }

    try {
      await updateBackupFailure(
        database,
        schema,
        settingsRow?.id ?? null,
        redactFailureReason(error)
      )
    } catch {
      // If status persistence fails, keep the original backup error as the user-facing failure.
    }

    throw error
  }
}

function parseBackupArgs(args: string[]): ParseResult {
  const options: BackupCliOptions = {
    dryRun: false,
    help: false,
    output: null,
    yes: false
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

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

    if (arg === "--output") {
      const value = args[index + 1]

      if (!value || value.startsWith("--")) {
        return { error: "--output requires a file path." }
      }

      options.output = value
      index += 1
      continue
    }

    if (arg.startsWith("--output=")) {
      const value = arg.slice("--output=".length)

      if (!value) return { error: "--output requires a file path." }

      options.output = value
      continue
    }

    if (arg === "--destination" || arg.startsWith("--destination=")) {
      return {
        error:
          "--destination is not implemented in this pass. Remote destinations land in Prompt 04."
      }
    }

    return { error: `Unknown option: ${arg}` }
  }

  return { data: options }
}

async function buildBackupPlan(
  database: Database,
  destination: BackupDestination,
  options: BackupCliOptions & { remitDataDir: string }
): Promise<BackupPlan> {
  const dataDir = path.resolve(options.remitDataDir)
  const outputPath = path.resolve(
    options.output ?? path.join(dataDir, DEFAULT_BACKUP_DIRNAME, buildBackupFilename(new Date()))
  )
  const backupsDir = path.resolve(dataDir, DEFAULT_BACKUP_DIRNAME)
  const uploadsDirectory = resolveLocalUploadsDirectory(dataDir)
  const [tableNames, uploads] = await Promise.all([
    listDatabaseTables(database),
    listLocalStorageObjects({ rootDir: uploadsDirectory, skipDir: backupsDir })
  ])
  const uploadsTotalSize = uploads.reduce((sum, upload) => sum + upload.size, 0)

  return {
    destination,
    outputPath,
    tableNames,
    uploads,
    uploadsDirectory,
    uploadsTotalSize
  }
}

function buildBackupFilename(date: Date, appVersion: string = pkg.version): string {
  const timestamp = date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z")

  return `remit-backup-${timestamp}-v${appVersion}.remitbak`
}

async function writeLocalBackupArchive(
  database: Database,
  plan: BackupPlan,
  options: BackupCliOptions & {
    databaseUrl: string
    encryptionKey: Buffer
    remitDataDir: string
  }
): Promise<BackupResult> {
  if (options.encryptionKey.length !== 32) {
    throw new BackupCliError("REMIT_ENCRYPTION_KEY must decode to 32 bytes.")
  }

  const tempDir = path.join(path.resolve(options.remitDataDir), DEFAULT_BACKUP_DIRNAME, ".tmp")
  await mkdir(tempDir, { recursive: true })

  const dump = await dumpDatabaseToTempFile(options.databaseUrl, tempDir)
  const uploadDescriptors = await describeUploads(plan.uploads)
  const checksums = buildChecksumsFile(dump, uploadDescriptors)
  const checksumsBuffer = Buffer.from(checksums, "utf8")
  const manifest = buildBackupManifest({
    appVersion: pkg.version,
    checksumsSha256: sha256Hex(checksumsBuffer),
    components: {
      database: {
        size: dump.size,
        sha256: dump.sha256
      },
      uploads: {
        fileCount: uploadDescriptors.length,
        totalSize: uploadDescriptors.reduce((sum, upload) => sum + upload.size, 0)
      }
    },
    createdAt: new Date().toISOString(),
    destination: "local",
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

  return {
    archivePath: plan.outputPath,
    manifest,
    wrote: true
  }
}

async function dumpDatabaseToTempFile(
  databaseUrl: string,
  tempDir: string
): Promise<DatabaseDumpDescriptor> {
  const dumpPath = path.join(tempDir, `remit-database-${randomUUID()}.dump`)
  const output = createWriteStream(dumpPath, { flags: "wx" })
  const hash = createHash("sha256")
  let size = 0
  let stderr = ""

  const pgDump = resolvePgDumpCommand()
  const child = spawn(pgDump.command, pgDump.args, {
    env: {
      ...process.env,
      ...databaseUrlToPgEnv(databaseUrl),
      PG_COLOR: "never"
    },
    stdio: ["ignore", "pipe", "pipe"]
  })

  if (!child.stdout || !child.stderr) {
    throw new BackupCliError("pg_dump did not expose stdout/stderr streams.")
  }

  child.stderr.setEncoding("utf8")
  child.stderr.on("data", (chunk: string) => {
    stderr = `${stderr}${chunk}`.slice(-4000)
  })

  const stdoutPromise = writeDumpStream(child.stdout, output, hash, (bytes) => {
    size += bytes
  })
  const exitPromise = waitForProcess(child)

  try {
    const [, exitCode] = await Promise.all([stdoutPromise, exitPromise])

    if (exitCode !== 0) {
      throw new BackupCliError(
        `pg_dump failed. Run pnpm services:up first and confirm the app container can reach PostgreSQL. ${redactFailureReason(stderr)}`
      )
    }

    return {
      path: dumpPath,
      sha256: hash.digest("hex"),
      size
    }
  } catch (error) {
    child.kill("SIGTERM")
    await rm(dumpPath, { force: true })
    throw error
  }
}

function resolvePgDumpCommand(): { args: string[]; command: string } {
  const args = ["--format=custom", "--no-owner", "--no-privileges"]

  if (process.platform !== "win32") {
    return { args, command: "pg_dump" }
  }

  return {
    args: ["/d", "/s", "/c", `pg_dump ${args.join(" ")}`],
    command: "cmd.exe"
  }
}

async function writeDumpStream(
  source: Readable,
  output: Writable,
  hash: ReturnType<typeof createHash>,
  onChunk: (bytes: number) => void
): Promise<void> {
  try {
    for await (const chunk of source) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      hash.update(buffer)
      onChunk(buffer.length)

      if (!output.write(buffer)) {
        await once(output, "drain")
      }
    }
  } finally {
    output.end()
  }

  await finished(output)
}

async function waitForProcess(child: ReturnType<typeof spawn>): Promise<number> {
  return await new Promise((resolve, reject) => {
    child.once("error", reject)
    child.once("close", (code) => resolve(code ?? 1))
  })
}

function databaseUrlToPgEnv(databaseUrl: string): Record<string, string> {
  const url = new URL(databaseUrl)
  const values: Record<string, string | undefined> = {
    PGDATABASE: decodeURIComponent(url.pathname.replace(/^\//, "")),
    PGHOST: url.hostname,
    PGPASSWORD: url.password ? decodeURIComponent(url.password) : undefined,
    PGPORT: url.port || undefined,
    PGSSLMODE: url.searchParams.get("sslmode") ?? undefined,
    PGUSER: url.username ? decodeURIComponent(url.username) : undefined
  }

  return Object.fromEntries(
    Object.entries(values).filter((entry): entry is [string, string] => Boolean(entry[1]))
  )
}

async function describeUploads(uploads: LocalStorageObject[]): Promise<UploadDescriptor[]> {
  return await Promise.all(
    uploads.map(async (upload) => ({
      ...upload,
      archivePath: `uploads/${upload.key}`,
      sha256: await hashFile(upload.absolutePath)
    }))
  )
}

async function hashFile(filePath: string): Promise<string> {
  const hash = createHash("sha256")
  const stream = createReadStream(filePath)

  for await (const chunk of stream) {
    hash.update(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  return hash.digest("hex")
}

function buildChecksumsFile(dump: DatabaseDumpDescriptor, uploads: UploadDescriptor[]): string {
  return [
    `${dump.sha256}  database/remit.dump`,
    ...uploads.map((upload) => `${upload.sha256}  ${upload.archivePath}`)
  ]
    .join("\n")
    .concat("\n")
}

async function writeEncryptedTar(input: {
  checksums: Buffer
  databaseDump: DatabaseDumpDescriptor
  encryptionKey: Buffer
  manifest: Buffer
  outputPath: string
  uploads: UploadDescriptor[]
}): Promise<void> {
  await mkdir(path.dirname(input.outputPath), { recursive: true })

  const tempOutputPath = `${input.outputPath}.${randomUUID()}.tmp`
  const iv = randomBytes(12)
  const header = Buffer.alloc(ARCHIVE_HEADER_LENGTH)
  writeArchiveHeader(header, {
    iv,
    keyFingerprint: computeKeyFingerprint(input.encryptionKey)
  })

  const output = createWriteStream(tempOutputPath, { flags: "wx" })
  await writeToStream(output, header)

  const gzip = createGzip()
  const encryption = encryptStream(input.encryptionKey, iv)
  gzip.pipe(encryption.stream).pipe(output, { end: false })

  const tar = new TarWriter(gzip)

  try {
    await tar.writeBufferEntry("manifest.json", input.manifest)
    await tar.writeBufferEntry("checksums.sha256", input.checksums)
    await tar.writeFileEntry(
      "database/remit.dump",
      input.databaseDump.size,
      createReadStream(input.databaseDump.path)
    )

    for (const upload of input.uploads) {
      await tar.writeFileEntry(
        upload.archivePath,
        upload.size,
        createLocalStorageReadStream(upload)
      )
    }

    await tar.finalize()
    await finished(encryption.stream)

    output.end(encryption.getAuthTag())

    await finished(output)
    await rm(input.outputPath, { force: true })
    await rename(tempOutputPath, input.outputPath)
  } catch (error) {
    gzip.destroy()
    encryption.stream.destroy()
    output.destroy()

    await rm(tempOutputPath, { force: true })

    throw error
  }
}

class TarWriter {
  constructor(private readonly output: Writable) {}

  async writeBufferEntry(name: string, buffer: Buffer): Promise<void> {
    await this.writeHeader(name, buffer.length)
    await writeToStream(this.output, buffer)
    await this.writePadding(buffer.length)
  }

  async writeFileEntry(name: string, size: number, source: Readable): Promise<void> {
    await this.writeHeader(name, size)

    for await (const chunk of source) {
      await writeToStream(this.output, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }

    await this.writePadding(size)
  }

  async finalize(): Promise<void> {
    await writeToStream(this.output, Buffer.alloc(TAR_BLOCK_SIZE * 2))
    this.output.end()
  }

  private async writeHeader(name: string, size: number): Promise<void> {
    await writeToStream(this.output, buildTarHeader({ name, size }))
  }

  private async writePadding(size: number): Promise<void> {
    const remainder = size % TAR_BLOCK_SIZE

    if (remainder === 0) return

    await writeToStream(this.output, Buffer.alloc(TAR_BLOCK_SIZE - remainder))
  }
}

function buildTarHeader(input: { name: string; size: number }): Buffer {
  const header = Buffer.alloc(TAR_BLOCK_SIZE, 0)
  const nameParts = splitTarName(input.name)

  writeAscii(header, nameParts.name, 0, 100)
  writeOctal(header, 0o644, 100, 8)
  writeOctal(header, 0, 108, 8)
  writeOctal(header, 0, 116, 8)
  writeOctal(header, input.size, 124, 12)
  writeOctal(header, Math.floor(Date.now() / 1000), 136, 12)
  header.fill(0x20, 148, 156)
  header.write("0", 156, 1, "ascii")
  header.write("ustar\0", 257, 6, "ascii")
  header.write("00", 263, 2, "ascii")
  writeAscii(header, "remit", 265, 32)
  writeAscii(header, "remit", 297, 32)
  writeAscii(header, nameParts.prefix, 345, 155)

  const checksum = header.reduce((sum, byte) => sum + byte, 0)
  writeOctal(header, checksum, 148, 8)

  return header
}

function splitTarName(value: string): { name: string; prefix: string } {
  const normalized = value.replaceAll("\\", "/")

  if (Buffer.byteLength(normalized, "utf8") <= 100) {
    return { name: normalized, prefix: "" }
  }

  const slashIndex = normalized.lastIndexOf("/")

  if (slashIndex === -1) {
    throw new BackupCliError(`Archive path is too long for ustar: ${normalized}`)
  }

  const prefix = normalized.slice(0, slashIndex)
  const name = normalized.slice(slashIndex + 1)

  if (Buffer.byteLength(name, "utf8") > 100 || Buffer.byteLength(prefix, "utf8") > 155) {
    throw new BackupCliError(`Archive path is too long for ustar: ${normalized}`)
  }

  return { name, prefix }
}

function writeAscii(buffer: Buffer, value: string, offset: number, length: number): void {
  const bytes = Buffer.from(value, "utf8")

  if (bytes.length > length) {
    throw new BackupCliError(`Tar field is too long: ${value}`)
  }

  bytes.copy(buffer, offset)
}

function writeOctal(buffer: Buffer, value: number, offset: number, length: number): void {
  const octal = value.toString(8)
  const field = `${octal.padStart(length - 2, "0")}\0 `

  buffer.write(field, offset, length, "ascii")
}

async function writeToStream(output: Writable, buffer: Buffer): Promise<void> {
  if (!output.write(buffer)) {
    await once(output, "drain")
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

async function getLatestAppliedMigrationId(database: Database): Promise<string> {
  const migrationTableRows = await database.execute(sql`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'drizzle'
        AND table_name = '__drizzle_migrations'
    ) AS exists
  `)
  const [migrationTableRow] = Array.from(migrationTableRows as Iterable<{ exists: boolean }>)

  if (!migrationTableRow?.exists) {
    return "none"
  }

  const rows = await database.execute(sql`
    SELECT COUNT(*)::int AS count
    FROM drizzle.__drizzle_migrations
  `)
  const [row] = Array.from(rows as Iterable<{ count: number }>)
  const appliedCount = row?.count ?? 0

  if (appliedCount <= 0) {
    return "none"
  }

  const entry = migrationJournal.entries[appliedCount - 1] ?? migrationJournal.entries.at(-1)

  return entry?.tag ?? "none"
}

async function confirmOverwrite(outputPath: string, yes: boolean): Promise<void> {
  const exists = await pathExists(outputPath)

  if (!exists) return

  if (yes) {
    return
  }

  const confirmed = await p.confirm({
    message: `Overwrite existing backup at ${outputPath}?`,
    initialValue: false
  })

  if (p.isCancel(confirmed)) {
    p.cancel("Backup cancelled.")
    process.exit(0)
  }

  if (!confirmed) {
    p.cancel("No archive was written.")
    process.exit(0)
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath)

    return true
  } catch (error) {
    return !isMissingPathError(error)
  }
}

async function updateBackupSuccess(
  database: Database,
  schema: Schema,
  settingsId: string | null
): Promise<void> {
  const update = {
    backupLastFailureAt: null,
    backupLastFailureReason: null,
    backupLastSuccessAt: new Date()
  }

  if (settingsId) {
    await database.update(schema.settings).set(update).where(eq(schema.settings.id, settingsId))
    return
  }

  await database.insert(schema.settings).values(update)
}

async function updateBackupFailure(
  database: Database,
  schema: Schema,
  settingsId: string | null,
  reason: string
): Promise<void> {
  const update = {
    backupLastFailureAt: new Date(),
    backupLastFailureReason: reason
  }

  if (settingsId) {
    await database.update(schema.settings).set(update).where(eq(schema.settings.id, settingsId))
    return
  }

  await database.insert(schema.settings).values(update)
}

function formatPlan(plan: BackupPlan): string {
  return [
    `${chalk.bold("Destination")}: ${plan.destination}`,
    `${chalk.bold("Output")}: ${plan.outputPath}`,
    `${chalk.bold("Uploads directory")}: ${plan.uploadsDirectory}`,
    `${chalk.bold("Uploads")}: ${plan.uploads.length} files, ${formatBytes(plan.uploadsTotalSize)}`,
    "",
    chalk.bold("Tables"),
    ...plan.tableNames.map((table) => `  ${table}`)
  ].join("\n")
}

function getBackupHelpText(): string {
  const command = chalk.bold("pnpm remit:backup")
  const option = (value: string) => chalk.cyan(value)
  const heading = (value: string) => chalk.bold(value)
  const optionLine = (flag: string, description: string) =>
    `  ${option(flag.padEnd(18))} ${description}`

  return [
    heading("Usage"),
    `  ${command} ${option("[--output <path>]")} ${option("[--dry-run]")} ${option("[--yes]")} ${option("[--help]")}`,
    "",
    heading("Purpose"),
    "  Write an encrypted local .remitbak archive containing the PostgreSQL dump and uploads.",
    "",
    heading("Options"),
    optionLine("--output <path>", "Write to an explicit local archive path."),
    optionLine("--dry-run", "Print the backup plan without writing an archive."),
    optionLine("--yes", "Skip confirmation when overwriting an existing output path."),
    optionLine("--help", "Print this help text."),
    "",
    heading("Deferred"),
    "  Remote destinations land in Prompt 04. Restore lands in Prompt 03."
  ].join("\n")
}

function formatBytes(bytes: number): string {
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 1,
    style: "unit",
    unit: "byte",
    unitDisplay: "short"
  }).format(bytes)
}

function redactFailureReason(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)

  if (message.includes("spawn pg_dump ENOENT")) {
    return "pg_dump is not installed on this machine. Run the backup in the app container with docker compose exec app pnpm remit:backup, or install the PostgreSQL 16 client locally and retry."
  }

  if (message.includes("ECONNREFUSED") || message.startsWith("Failed query:")) {
    return "Database unavailable. Run pnpm services:up first and confirm the app container can reach PostgreSQL."
  }

  return message
    .replace(/postgres(?:ql)?:\/\/[^@\s]+@/gi, "postgresql://[redacted]@")
    .replace(/(REMIT_ENCRYPTION_KEY=)[^\s]+/g, "$1[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500)
}

function formatErrorForCli(error: unknown): string {
  if (error instanceof BackupCliError) {
    return error.message
  }

  return (
    redactFailureReason(error) ||
    "Backup failed. Run pnpm services:up first and confirm database and filesystem access."
  )
}

function isMissingPathError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  )
}

function isDirectRun(): boolean {
  const scriptPath = process.argv[1]

  return Boolean(scriptPath) && import.meta.url === pathToFileURL(scriptPath).href
}

if (isDirectRun()) {
  main()
}
