import { runBackup } from "../backup/runBackup"

type Database = typeof import("@/database").database
type Schema = typeof import("@/database/schema")

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
