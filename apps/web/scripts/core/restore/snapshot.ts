import { runBackup } from "../backup/runBackup"

type Database = typeof import("@/database").database
type Schema = typeof import("@/database/schema")

// `skipStatusUpdate` is what stops a snapshot counting as a backup: in `backup/runBackup.ts` it
// suppresses both the `settings.backup_last_success_at` write and the `instance.backup.completed`
// audit entry, so the backup health check in `features/health/queries.ts` keeps reporting the last
// real backup instead of turning green because a restore happened to take one on the way past.
export async function takePreRestoreSnapshot(
  database: Database,
  schema: Schema,
  options: {
    databaseUrl: string
    encryptionKey: Buffer
    outputPath: string
    remitDataDir: string
  }
): Promise<void> {
  await runBackup(database, schema, {
    databaseUrl: options.databaseUrl,
    destinationOverride: "local",
    dryRun: false,
    encryptionKey: options.encryptionKey,
    help: false,
    output: options.outputPath,
    remitDataDir: options.remitDataDir,
    skipStatusUpdate: true,
    yes: true
  })
}
