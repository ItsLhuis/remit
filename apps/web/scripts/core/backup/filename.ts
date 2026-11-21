import path from "node:path"

export const DEFAULT_BACKUP_DIRNAME = "backups"
export const REMOTE_BACKUP_PREFIX = "remit-backups/"

const PRE_RESTORE_SUFFIX = ".pre-restore.remitbak"
const PRE_ROTATION_SUFFIX = ".pre-key-rotation.remitbak"

export function formatArchiveTimestamp(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z")
}

export function buildBackupFilename(date: Date, appVersion: string): string {
  return `remit-backup-${formatArchiveTimestamp(date)}-v${appVersion}.remitbak`
}

// Only the name `buildBackupFilename` writes. A pre-restore snapshot, a pre-rotation backup and an
// archive an operator named with --output do not match, so local retention never selects them:
// each is the one copy of something an operator asked for by hand, and only they delete it.
const BACKUP_FILENAME =
  /^remit-backup-(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z-v\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?\.remitbak$/

export function parseBackupFilenameTimestamp(filename: string): Date | null {
  // Checked by name as well as by pattern: a pre-release version's dotted identifiers would let a
  // snapshot's suffix pass for part of the version.
  if (filename.endsWith(PRE_RESTORE_SUFFIX) || filename.endsWith(PRE_ROTATION_SUFFIX)) return null

  const match = BACKUP_FILENAME.exec(filename)

  if (!match) return null

  const [, year, month, day, hour, minute, second] = match.map(Number)
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second))

  return Number.isNaN(date.getTime()) ? null : date
}

export function buildRemoteBackupKey(date: Date, filename: string): string {
  const year = String(date.getUTCFullYear())
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")

  return `${REMOTE_BACKUP_PREFIX}${year}/${month}/${filename}`
}

export function buildPreRestoreSnapshotPath(
  remitDataDir: string,
  date: Date,
  appVersion: string
): string {
  return path.join(
    remitDataDir,
    DEFAULT_BACKUP_DIRNAME,
    `remit-backup-${formatArchiveTimestamp(date)}-v${appVersion}${PRE_RESTORE_SUFFIX}`
  )
}

export function buildPreRotationBackupPath(remitDataDir: string, date: Date): string {
  return path.join(
    path.resolve(remitDataDir),
    DEFAULT_BACKUP_DIRNAME,
    `remit-backup-${formatArchiveTimestamp(date)}${PRE_ROTATION_SUFFIX}`
  )
}
