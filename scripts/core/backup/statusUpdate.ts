import { eq } from "drizzle-orm"

type Database = typeof import("@/database").database
type Schema = typeof import("@/database/schema")

// Skip status write when no settings row exists yet rather than inserting a
// phantom settings row populated only with backup-status fields. Backup status
// belongs on the operator's real settings row, created during /setup.
export async function updateBackupSuccess(
  database: Database,
  schema: Schema,
  settingsId: string | null
): Promise<void> {
  if (!settingsId) {
    console.warn(
      "Backup succeeded but no settings row exists; skipping backup status update. Complete /setup to record backup status."
    )
    return
  }

  await database
    .update(schema.settings)
    .set({
      backupLastFailureAt: null,
      backupLastFailureReason: null,
      backupLastSuccessAt: new Date()
    })
    .where(eq(schema.settings.id, settingsId))
}

export async function updateBackupFailure(
  database: Database,
  schema: Schema,
  settingsId: string | null,
  reason: string
): Promise<void> {
  if (!settingsId) {
    console.warn(
      "Backup failed and no settings row exists; skipping backup status update. Complete /setup to record backup status."
    )
    return
  }

  await database
    .update(schema.settings)
    .set({
      backupLastFailureAt: new Date(),
      backupLastFailureReason: reason
    })
    .where(eq(schema.settings.id, settingsId))
}
