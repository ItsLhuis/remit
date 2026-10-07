import chalk from "chalk"

export type RestoreCliOptions = {
  acceptOlderSchema: boolean
  backupFile: string
  dryRun: boolean
  help: boolean
  yes: boolean
}

export type RestoreArgsParseResult = { data: RestoreCliOptions } | { error: string }

export function parseRestoreArgs(args: string[]): RestoreArgsParseResult {
  const options: RestoreCliOptions = {
    acceptOlderSchema: false,
    backupFile: "",
    dryRun: false,
    help: false,
    yes: false
  }

  for (const arg of args) {
    if (arg === "--accept-older-schema") {
      options.acceptOlderSchema = true
      continue
    }

    if (arg === "--dry-run") {
      options.dryRun = true
      continue
    }

    if (arg === "--help") {
      options.help = true
      continue
    }

    if (arg === "--yes") {
      options.yes = true
      continue
    }

    if (arg.startsWith("--")) {
      return { error: `Unknown option: ${arg}` }
    }

    if (options.backupFile) {
      return { error: "Only one <backup-file> argument is supported." }
    }

    options.backupFile = arg
  }

  if (!options.help && !options.backupFile) {
    return { error: "<backup-file> is required." }
  }

  return { data: options }
}

export function getRestoreHelpText(): string {
  const command = chalk.bold("pnpm remit:restore")
  const option = (value: string) => chalk.cyan(value)
  const heading = (value: string) => chalk.bold(value)
  const optionLine = (flag: string, description: string) =>
    `  ${option(flag.padEnd(21))} ${description}`

  return [
    heading("Usage"),
    `  ${command} ${option("<backup-file|remit://destination/key>")} ${option("[--dry-run]")} ${option("[--yes]")} ${option("[--accept-older-schema]")} ${option("[--help]")}`,
    "",
    heading("Purpose"),
    "  Validate, decrypt, and restore a .remitbak archive produced by pnpm remit:backup.",
    "",
    heading("Options"),
    optionLine(
      "--dry-run",
      "Verify the archive and print what would change without writing anything."
    ),
    optionLine(
      "--yes",
      "Skip typed confirmations only when REMIT_ALLOW_UNATTENDED_RESTORE=1 is also set."
    ),
    optionLine(
      "--accept-older-schema",
      "Acknowledge an archive from an older schema migration, which is migrated forward after the restore. Required with --yes; asked for otherwise."
    ),
    optionLine("--help", "Print this help text."),
    "",
    heading("Schema"),
    "  An archive from an older schema migration is restored and migrated forward once acknowledged. An archive from a newer or unknown migration is refused: migrations only run forwards.",
    "",
    heading("Safety"),
    "  Restore always takes a local pre-restore snapshot before destructive work, writes and verifies every archived file, applies the database with pg_restore --single-transaction, then deletes stored files the archive does not contain.",
    "",
    heading("Remote archives"),
    "  Use remit://<destination>/<key> for remote archives, for example remit://s3/remit-backups/2026/05/archive.remitbak. Destination must be s3, r2, or b2.",
    "",
    heading("Deferred"),
    "  Partial restore, point-in-time restore, and --force-version are not implemented."
  ].join("\n")
}
