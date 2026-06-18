import chalk from "chalk"

import { type BackupDestination } from "../destination"

export type BackupCliOptions = {
  destinationOverride?: BackupDestination
  dryRun: boolean
  help: boolean
  output: string | null
  yes: boolean
}

export type BackupArgsParseResult = { data: BackupCliOptions } | { error: string }

const DESTINATION_VALUES: ReadonlyArray<BackupDestination> = ["local", "s3", "r2", "b2"]

export function parseBackupArgs(args: string[]): BackupArgsParseResult {
  const options: BackupCliOptions = {
    dryRun: false,
    help: false,
    output: null,
    yes: false
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

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

    if (arg === "--output") {
      const value = args[index + 1]

      if (!value || value.startsWith("--")) return { error: "--output requires a file path." }

      options.output = value
      index += 1
      continue
    }

    if (arg.startsWith("--output=")) {
      const value = arg.slice("--output=".length)
      if (!value) return { error: "--output requires a file path." }

      options.output = value
      continue
    }

    if (arg === "--destination") {
      const value = args[index + 1]

      if (!value || value.startsWith("--")) {
        return { error: "--destination requires one of: local, s3, r2, b2." }
      }

      const destination = parseBackupDestination(value)
      if (!destination) return { error: "--destination requires one of: local, s3, r2, b2." }

      options.destinationOverride = destination
      index += 1
      continue
    }

    if (arg.startsWith("--destination=")) {
      const destination = parseBackupDestination(arg.slice("--destination=".length))
      if (!destination) return { error: "--destination requires one of: local, s3, r2, b2." }

      options.destinationOverride = destination
      continue
    }

    return { error: `Unknown option: ${arg}` }
  }

  return { data: options }
}

export function parseBackupDestination(value: string): BackupDestination | null {
  return (DESTINATION_VALUES as readonly string[]).includes(value)
    ? (value as BackupDestination)
    : null
}

export function getBackupHelpText(): string {
  const command = chalk.bold("pnpm remit:backup")
  const option = (value: string) => chalk.cyan(value)
  const heading = (value: string) => chalk.bold(value)
  const optionLine = (flag: string, description: string) =>
    `  ${option(flag.padEnd(18))} ${description}`

  return [
    heading("Usage"),
    `  ${command} ${option("[--destination <local|s3|r2|b2>]")} ${option("[--output <path>]")} ${option("[--dry-run]")} ${option("[--yes]")} ${option("[--help]")}`,
    "",
    heading("Purpose"),
    "  Write an encrypted .remitbak archive containing the PostgreSQL dump and uploads.",
    "",
    heading("Options"),
    optionLine(
      "--destination <...>",
      "Override settings.backup_destination for one run; flag value wins over the saved setting."
    ),
    optionLine("--output <path>", "Write to an explicit local archive path."),
    optionLine("--dry-run", "Print the backup plan without writing an archive."),
    optionLine("--yes", "Skip confirmation when overwriting an existing output path."),
    optionLine("--help", "Print this help text."),
    "",
    heading("Remote destinations"),
    "  S3, R2, and B2 use the encrypted backup credentials saved in /settings/backup. --output is local-only."
  ].join("\n")
}
