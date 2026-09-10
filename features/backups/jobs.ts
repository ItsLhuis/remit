import { logger } from "@/lib/logger"

import { acquireBackupLock, releaseBackupLock } from "@/lib/backups/backupLock"
import { env } from "@/lib/config/env"
import { registerJobHandler } from "@/lib/jobs"

import { client, database } from "@/database"
import * as schema from "@/database/schema"

import { executeBackup } from "@/scripts/core/backup/executeBackup"
import { ROTATION_LOCK_ID } from "@/scripts/core/keyRotation/lock"

import { isBackupDue } from "./services"

// Distinguishes a scheduled archive from an operator's in the audit trail. Both write
// `instance.backup.completed`, so without this the trail cannot answer "did the schedule run, or did
// somebody run it by hand?" — the question an operator asks first when a backup is missing.
const SCHEDULED_USER_AGENT = "worker/backup"

registerJobHandler("backup.run.sweep", runScheduledBackup)

// The consumer `settings.backup_cadence` never had (ADR-0023). The scheduler fires this every night
// and the cadence decides here rather than in the cron pattern, so changing daily to weekly on
// `/settings/backup` needs no scheduler write and can never leave a second scheduler in Redis —
// see `lib/jobs/schedules.ts`.
async function runScheduledBackup(): Promise<void> {
  // ARCHITECTURE.md section 18: on a hosted instance the destination is the operator's and backups
  // are theirs to run. Registering the scheduler regardless keeps `REPEATABLE_JOBS` static, so the
  // refusal lives here where it is one branch rather than in the shape of the schedule.
  if (env.REMIT_HOSTED_MODE) return

  const settingsRow = await database.query.settings.findFirst({
    columns: { backupCadence: true, backupLastSuccessAt: true }
  })

  // No settings row means /setup has not run. There is no cadence to honour and no row to record an
  // outcome on, so an instance in that state has nothing worth archiving yet.
  if (!settingsRow) return

  if (
    !isBackupDue({
      cadence: settingsRow.backupCadence,
      lastSuccessAt: settingsRow.backupLastSuccessAt,
      now: new Date()
    })
  ) {
    return
  }

  if (await isKeyRotationRunning()) {
    logger.warn(
      { action: "backup.run.sweep" },
      "Scheduled backup skipped: an encryption key rotation is in progress"
    )

    return
  }

  const lock = await acquireBackupLock(client)

  if (!lock) {
    logger.warn(
      { action: "backup.run.sweep" },
      "Scheduled backup skipped: another backup is already running"
    )

    return
  }

  try {
    const result = await executeBackup(database, schema, {
      databaseUrl: env.DATABASE_URL,
      encryptionKey: Buffer.from(env.REMIT_ENCRYPTION_KEY, "base64"),
      output: null,
      remitDataDir: env.REMIT_DATA_DIR,
      userAgent: SCHEDULED_USER_AGENT
    })

    logger.info(
      {
        action: "backup.run.sweep",
        destination: result.manifest.destination,
        archive: result.archivePath
      },
      "Scheduled backup completed"
    )
  } catch (error) {
    // Swallowed rather than rethrown, and that is the one place this job departs from the sweeps
    // beside it. `DEFAULT_JOB_OPTIONS` gives every job five attempts, and a backup that failed
    // because the bucket does not exist fails identically on all five — five `pg_dump`s, five
    // archive writes, five failure rows. `executeBackup` has already recorded the failure on
    // `settings` and in the audit log by the time this runs, so the outcome is durable and visible;
    // the retry is tomorrow's occurrence, which is inside the banner's grace window either way.
    logger.error({ action: "backup.run.sweep", err: error }, "Scheduled backup failed")
  } finally {
    await releaseBackupLock(lock)
  }
}

// A rotation rewrites the encrypted columns *and* re-encrypts the `.remitbak` envelopes at the
// configured destination (ADR-0021). An archive uploaded after that pass has listed the bucket is
// one the rotation never re-encrypts, so it stays readable only by the retired key while everything
// around it moved on. Skipping the occurrence is the cheap side of that trade: the next night's run
// takes the archive instead.
//
// Tested and released rather than held for the run: `scripts/core/keyRotation/runRotation.ts`
// deliberately drops this lock while it takes its own pre-rotation backup and re-acquires it
// afterwards, so holding it here would abort a rotation that had already started.
async function isKeyRotationRunning(): Promise<boolean> {
  // A reserved connection, because both statements have to land on the same session: an advisory
  // lock belongs to the session that took it, and unlocking from a different pooled connection
  // would leave this one held for the life of the worker.
  const reserved = await client.reserve()

  try {
    const rows = (await reserved`
      SELECT pg_try_advisory_lock(${ROTATION_LOCK_ID}::bigint) AS acquired
    `) as Array<{ acquired: boolean }>
    const acquired = rows[0]?.acquired === true

    if (acquired) {
      await reserved`SELECT pg_advisory_unlock(${ROTATION_LOCK_ID}::bigint)`
    }

    return !acquired
  } finally {
    reserved.release()
  }
}
