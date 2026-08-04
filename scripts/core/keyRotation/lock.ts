import type postgres from "postgres"

import { RotationCliError } from "./errors"

type Sql = postgres.Sql
type ReservedSql = postgres.ReservedSql

export const ROTATION_LOCK_ID = "5928229461845757780"

export async function acquireRotationLock(client: Sql): Promise<ReservedSql> {
  // The lock is taken on a reserved connection and the same connection is handed back to the
  // caller, because a `pg_advisory_lock` lives on the session that took it. Taking it through the
  // pool would let the connection be returned between statements, so a second rotation could
  // acquire the lock while the first was still rewriting tables, and the unlock would run on
  // whichever session happened to be free.
  const reserved = await client.reserve()
  let acquired = false

  try {
    const rows = (await reserved`
      SELECT pg_try_advisory_lock(${ROTATION_LOCK_ID}::bigint) AS acquired
    `) as Array<{ acquired: boolean }>
    const [row] = rows
    acquired = row?.acquired === true

    if (!acquired) {
      throw new RotationCliError(
        "Refusing rotation: another encryption key rotation is already in progress."
      )
    }

    return reserved
  } catch (error) {
    if (!acquired) {
      reserved.release()
    }
    throw error
  }
}

export async function releaseRotationLock(lock: ReservedSql | null): Promise<void> {
  if (!lock) return

  try {
    await lock`
      SELECT pg_advisory_unlock(${ROTATION_LOCK_ID}::bigint)
    `
  } finally {
    lock.release()
  }
}
