export type BackupLockHolder = "scheduled-backup" | "manual-backup" | "restore" | "key-rotation"

export type BackupLockHolderInfo = {
  holder: BackupLockHolder
  since: Date
}

const LABEL_PREFIX = "remit-backup-lock"

const HOLDER_DESCRIPTIONS: Record<BackupLockHolder, string> = {
  "scheduled-backup": "a scheduled backup",
  "manual-backup": "a backup run with pnpm remit:backup",
  restore: "a restore run with pnpm remit:restore",
  "key-rotation": "an encryption key rotation"
}

// The label the lock's session carries as its `application_name`, which is how a refused caller
// learns what is running: an advisory lock holds no data of its own, and `pg_stat_activity` is the
// one place another session can read something about the holder. Postgres truncates an
// application name at 63 bytes, and the longest label this builds is 58.
export function formatBackupLockLabel(holder: BackupLockHolder, since: Date): string {
  return `${LABEL_PREFIX}:${holder}:${since.toISOString()}`
}

// Returns null for anything this build did not write — a session that took the lock under an older
// build, or one whose name was changed since — so the caller falls back to a message that names no
// holder rather than guessing one.
export function parseBackupLockLabel(label: string | null): BackupLockHolderInfo | null {
  if (!label?.startsWith(`${LABEL_PREFIX}:`)) return null

  const rest = label.slice(LABEL_PREFIX.length + 1)
  const separator = rest.indexOf(":")

  if (separator === -1) return null

  const holder = rest.slice(0, separator)
  const since = new Date(rest.slice(separator + 1))

  if (!isBackupLockHolder(holder) || Number.isNaN(since.getTime())) return null

  return { holder, since }
}

export function describeBackupLockHolder(info: BackupLockHolderInfo | null): string {
  if (!info) return "another backup, restore or key rotation"

  return `${HOLDER_DESCRIPTIONS[info.holder]} (running since ${info.since.toISOString()})`
}

function isBackupLockHolder(value: string): value is BackupLockHolder {
  return Object.hasOwn(HOLDER_DESCRIPTIONS, value)
}
