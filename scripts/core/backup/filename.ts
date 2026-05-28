import path from "node:path"

export const DEFAULT_BACKUP_DIRNAME = "backups"
export const REMOTE_BACKUP_PREFIX = "remit-backups/"

export function formatArchiveTimestamp(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z")
}

export function buildBackupFilename(date: Date, appVersion: string): string {
  return `remit-backup-${formatArchiveTimestamp(date)}-v${appVersion}.remitbak`
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
    `remit-backup-${formatArchiveTimestamp(date)}-v${appVersion}.pre-restore.remitbak`
  )
}

export function buildPreRotationBackupPath(remitDataDir: string, date: Date): string {
  return path.join(
    path.resolve(remitDataDir),
    DEFAULT_BACKUP_DIRNAME,
    `remit-backup-${formatArchiveTimestamp(date)}.pre-key-rotation.remitbak`
  )
}
