import type postgres from "postgres"

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
// `pg_try_advisory_lock` rather than `pg_advisory_lock`: a backup that waits is a backup that piles
// up behind a slow one until the queue is nothing but backups. The caller decides what a refusal
// means — the sweep skips this occurrence, the CLI says so and exits non-zero.
export async function acquireBackupLock(client: Sql): Promise<ReservedSql | null> {
  // The lock lives on the session that took it, so the connection is reserved and handed back to
  // the caller. Taking it through the pool would let the connection be returned between statements,
  // and the unlock would run on whichever session happened to be free.
  const reserved = await client.reserve()

  try {
    const rows = (await reserved`
      SELECT pg_try_advisory_lock(${BACKUP_LOCK_ID}::bigint) AS acquired
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
  } finally {
    lock.release()
  }
}
