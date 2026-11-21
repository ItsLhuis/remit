import type postgres from "postgres"

import {
  formatBackupLockLabel,
  parseBackupLockLabel,
  type BackupLockHolder,
  type BackupLockHolderInfo
} from "./backupLockHolder"

type Sql = postgres.Sql
type ReservedSql = postgres.ReservedSql

// A different key space from `scripts/core/keyRotation/lock.ts`'s `ROTATION_LOCK_ID`: a rotation
// takes its own pre-rotation backup through this same path, so sharing one id would make the
// rotation deadlock against itself.
export const BACKUP_LOCK_ID = "7261890413556104219"

// Session-scoped rather than transaction-scoped, and that is the whole reason a Postgres advisory
// lock is the guard here rather than a BullMQ job id. A job id collapses duplicate *enqueues* and
// is released the instant the job completes, and it is invisible to `pnpm remit:backup` running in
// the app container — the realistic overlap is an operator backing up by hand while the sweep
// fires, and both would `pg_dump` the same database and race the same retention pass. A session
// lock covers both processes, and a worker that dies holding it ends its session, so Postgres
// releases the lock without anything having to notice the crash.
//
// Every path that writes an archive or swaps restored data takes it: the scheduled sweep
// (`features/backups/jobs.ts`), `pnpm remit:backup` (`scripts/core/backup/runBackup.ts`'s
// `runOperatorBackup`), and a restore and a key rotation for their whole run. The last two take a
// backup of their own on the way — the pre-restore snapshot, the pre-rotation backup — and that
// backup takes no lock: it runs under the one its operation already holds. Taking it again would be
// harmless on the same session, but the backup pipeline runs on the pool, so it would land on a
// different session and refuse the very operation that needs it.
//
// `pg_try_advisory_lock` rather than `pg_advisory_lock`: a backup that waits is a backup that piles
// up behind a slow one until the queue is nothing but backups. The caller decides what a refusal
// means — the sweep skips this occurrence, the CLI says so and exits non-zero.
export async function acquireBackupLock(
  client: Sql,
  holder: BackupLockHolder,
  now: Date = new Date()
): Promise<ReservedSql | null> {
  // The lock lives on the session that took it, so the connection is reserved and handed back to
  // the caller. Taking it through the pool would let the connection be returned between statements,
  // and the unlock would run on whichever session happened to be free.
  const reserved = await client.reserve()

  try {
    // One statement, so there is no moment the lock is held without its label, and no failure
    // between the two that would hand a still-locked session back to the pool.
    const rows = (await reserved`
      SELECT CASE
        WHEN pg_try_advisory_lock(${BACKUP_LOCK_ID}::bigint)
          THEN set_config('application_name', ${formatBackupLockLabel(holder, now)}, false) IS NOT NULL
        ELSE false
      END AS acquired
    `) as Array<{ acquired: boolean }>
    const [row] = rows

    if (row?.acquired !== true) {
      reserved.release()

      return null
    }

    return reserved
  } catch (error) {
    reserved.release()

    throw error
  }
}

export async function releaseBackupLock(lock: ReservedSql | null): Promise<void> {
  if (!lock) return

  try {
    await lock`
      SELECT pg_advisory_unlock(${BACKUP_LOCK_ID}::bigint)
    `
    // The connection goes back to the pool, where a later query would otherwise still announce
    // itself as the lock's holder to anyone reading `pg_stat_activity`.
    await lock`RESET application_name`
  } finally {
    lock.release()
  }
}

// What a refused caller reports. A bigint advisory key is split across `classid` (high half) and
// `objid` (low half) in `pg_locks`, with `objsubid` 1 marking the single-bigint form, so the key is
// reassembled here rather than compared to either column alone. Null when nothing holds the lock any
// more or the holder carries no label this build wrote.
export async function findBackupLockHolder(client: Sql): Promise<BackupLockHolderInfo | null> {
  const rows = (await client`
    SELECT activity.application_name
    FROM pg_locks AS locks
    JOIN pg_stat_activity AS activity ON activity.pid = locks.pid
    WHERE locks.locktype = 'advisory'
      AND locks.granted
      AND locks.objsubid = 1
      AND ((locks.classid::bigint << 32) | locks.objid::bigint) = ${BACKUP_LOCK_ID}::bigint
    LIMIT 1
  `) as Array<{ application_name: string | null }>

  return parseBackupLockLabel(rows[0]?.application_name ?? null)
}
