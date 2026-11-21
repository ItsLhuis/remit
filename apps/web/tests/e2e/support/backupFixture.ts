import { spawn, spawnSync } from "node:child_process"
import { readdir, rm, stat } from "node:fs/promises"
import path from "node:path"

import { and, eq } from "drizzle-orm"

import { loadAppContext } from "./appContext"

type BackupSettingsSnapshot = {
  settingsId: string
  backupCadence: "daily" | "weekly"
  backupRetentionDaily: number
  backupRetentionWeekly: number
  backupRetentionMonthly: number
  backupTestConnectionAt: Date | null
  backupLastSuccessAt: Date | null
  backupLastFailureAt: Date | null
  backupLastFailureReason: string | null
}

type BackupArchive = {
  name: string
  size: number
}

const BACKUP_COMMAND_TIMEOUT_MS = 120_000

// Whether a backup can run from this process. `pg_dump` is the one dependency a backup has outside
// Node: the e2e workflow installs the PostgreSQL client on the runner, and a developer host without
// one turns this into a skip with a reason rather than a failure that says nothing about the page.
// Resolved through the shell, as `scripts/core/backup/databaseDump.ts` does on Windows so PATHEXT
// finds `pg_dump.exe`; one fixed command string, so there is no argument for the shell to mangle.
export function isPgDumpAvailable(): boolean {
  const result = spawnSync("pg_dump --version", { shell: true, stdio: "ignore" })

  return result.status === 0
}

// The backup columns a spec rewrites, so it can put them back afterwards. An instance whose backups
// go to a remote destination answers `null` and is left alone: restoring it would mean holding its
// real bucket credentials, and a test archive would be uploaded into the owner's own bucket.
export async function snapshotLocalBackupSettings(): Promise<BackupSettingsSnapshot | null> {
  const { database } = await loadAppContext()

  const settingsRow = await database.query.settings.findFirst({
    columns: {
      id: true,
      backupDestination: true,
      backupCadence: true,
      backupRetentionDaily: true,
      backupRetentionWeekly: true,
      backupRetentionMonthly: true,
      backupTestConnectionAt: true,
      backupLastSuccessAt: true,
      backupLastFailureAt: true,
      backupLastFailureReason: true
    }
  })

  if (!settingsRow) throw new Error("No settings row: complete instance setup before running e2e")

  if (settingsRow.backupDestination !== "local") return null

  return {
    settingsId: settingsRow.id,
    backupCadence: settingsRow.backupCadence,
    backupRetentionDaily: settingsRow.backupRetentionDaily,
    backupRetentionWeekly: settingsRow.backupRetentionWeekly,
    backupRetentionMonthly: settingsRow.backupRetentionMonthly,
    backupTestConnectionAt: settingsRow.backupTestConnectionAt,
    backupLastSuccessAt: settingsRow.backupLastSuccessAt,
    backupLastFailureAt: settingsRow.backupLastFailureAt,
    backupLastFailureReason: settingsRow.backupLastFailureReason
  }
}

export async function restoreBackupSettings(snapshot: BackupSettingsSnapshot): Promise<void> {
  const { database, schema } = await loadAppContext()

  const { settingsId, ...columns } = snapshot

  await database
    .update(schema.settings)
    .set({ ...columns, backupDestination: "local" })
    .where(eq(schema.settings.id, settingsId))
}

// Moves the instance to the state a spec starts from. Written to the row directly because no form
// sets when a backup last succeeded, and that date is what decides whether tonight is a backup night.
export async function setBackupState(
  snapshot: BackupSettingsSnapshot,
  state: Partial<Pick<BackupSettingsSnapshot, "backupCadence" | "backupLastSuccessAt">>
): Promise<void> {
  const { database, schema } = await loadAppContext()

  await database
    .update(schema.settings)
    .set(state)
    .where(eq(schema.settings.id, snapshot.settingsId))
}

// How many archives the audit trail says the schedule has taken, told apart from an operator's by
// the user agent `features/backups/jobs.ts` writes. A count rather than a time window, so the
// database's clock and this process's never have to agree.
export async function countScheduledBackups(): Promise<number> {
  const { database, schema } = await loadAppContext()

  const rows = await database
    .select({ id: schema.auditLogs.id })
    .from(schema.auditLogs)
    .where(
      and(
        eq(schema.auditLogs.event, "instance.backup.completed"),
        eq(schema.auditLogs.userAgent, "worker/backup")
      )
    )

  return rows.length
}

// The local destination as the Playwright process resolves it. In the e2e stack REMIT_DATA_DIR is
// the directory docker-compose.yml bind-mounts into the app and worker containers as /app/data, so
// an archive either container writes lands here, as does one this process writes itself.
export async function listBackupArchives(): Promise<BackupArchive[]> {
  const directory = await getBackupsDirectory()

  const names = await readdir(directory).catch(() => [])

  return await Promise.all(
    names
      .filter((name) => name.endsWith(".remitbak"))
      .map(async (name) => ({ name, size: (await stat(path.join(directory, name))).size }))
  )
}

export async function removeBackupArchives(archives: readonly BackupArchive[]): Promise<void> {
  const directory = await getBackupsDirectory()

  await Promise.all(archives.map((archive) => rm(path.join(directory, archive.name))))
}

// The operator's command, `pnpm remit:backup --yes`, run from source as its own process the way
// `jobWorker.ts` runs the worker, against the same database and data directory as the application.
export async function runBackupCommand(): Promise<void> {
  await loadAppContext()

  const child = spawn(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "scripts/backup.ts", "--yes"],
    { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] }
  )

  let output = ""

  child.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()))
  child.stderr.on("data", (chunk: Buffer) => (output += chunk.toString()))

  const exitCode = await new Promise<number | null>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGTERM")
      reject(new Error(`pnpm remit:backup did not finish within the timeout:\n${output}`))
    }, BACKUP_COMMAND_TIMEOUT_MS)

    child.once("exit", (code) => {
      clearTimeout(timer)
      resolve(code)
    })
  })

  if (exitCode !== 0) throw new Error(`pnpm remit:backup exited with ${exitCode}:\n${output}`)
}

async function getBackupsDirectory(): Promise<string> {
  await loadAppContext()

  const [{ env }, { DEFAULT_BACKUP_DIRNAME }] = await Promise.all([
    import("@/lib/config/env"),
    import("@/scripts/core/backup/filename")
  ])

  return path.resolve(env.REMIT_DATA_DIR, DEFAULT_BACKUP_DIRNAME)
}
