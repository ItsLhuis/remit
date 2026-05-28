import * as p from "@clack/prompts"

import { loadCliEnvironment } from "./core/cli/bootstrap"

import { isDirectRunNamed } from "./core/cli/isDirectRun"

import { getBackupHelpText, parseBackupArgs } from "./core/backup/args"

import { formatBackupError, runBackup } from "./core/backup/runBackup"

export { runBackup }

export type { RunBackupOptions, BackupResult } from "./core/backup/runBackup"

async function main(): Promise<void> {
  loadCliEnvironment()

  const parsed = parseBackupArgs(process.argv.slice(2))

  if ("error" in parsed) {
    console.error(parsed.error)
    console.log("")
    console.log(getBackupHelpText())
    process.exit(1)
  }

  if (parsed.data.help) {
    console.log(getBackupHelpText())
    process.exit(0)
  }

  p.intro("Remit backup")

  const [{ database, client }, schema, { env }] = await Promise.all([
    import("@/database"),
    import("@/database/schema"),
    import("@/lib/config/env")
  ])

  try {
    const result = await runBackup(database, schema, {
      ...parsed.data,
      databaseUrl: env.DATABASE_URL,
      encryptionKey: Buffer.from(env.REMIT_ENCRYPTION_KEY, "base64"),
      remitDataDir: env.REMIT_DATA_DIR
    })

    if (result.wrote) {
      p.outro(`Backup complete.\n${result.archivePath}`)
    } else {
      p.outro("Dry run complete. No archive was written.")
    }

    process.exit(0)
  } catch (error) {
    p.cancel("Backup failed.")
    console.error(formatBackupError(error))
    process.exit(1)
  } finally {
    await client.end()
  }
}

if (isDirectRunNamed(import.meta.url, "backup")) {
  main()
}
