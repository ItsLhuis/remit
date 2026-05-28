import type postgres from "postgres"

import { RotationCliError } from "./errors"

type Sql = postgres.Sql
type ReservedSql = postgres.ReservedSql

export const ROTATION_LOCK_ID = "5928229461845757780"

export async function acquireRotationLock(client: Sql): Promise<ReservedSql> {
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
