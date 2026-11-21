import chalk from "chalk"

export type RotateCliOptions = {
  backupFile: string | null
  dryRun: boolean
  help: boolean
  resume: boolean
}

export type RotateArgsParseResult = { data: RotateCliOptions } | { error: string }

export function parseRotateArgs(args: string[]): RotateArgsParseResult {
  const options: RotateCliOptions = {
    backupFile: null,
    dryRun: false,
    help: false,
    resume: false
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

    if (arg === "--resume") {
      options.resume = true
      continue
    }

    if (arg === "--backup-file") {
      const value = args[index + 1]

      if (!value || value.startsWith("--")) {
        return { error: "--backup-file requires a .remitbak path." }
      }

      options.backupFile = value
      index += 1
      continue
    }

    if (arg.startsWith("--backup-file=")) {
      const value = arg.slice("--backup-file=".length)

      if (!value) {
        return { error: "--backup-file requires a .remitbak path." }
      }

      options.backupFile = value
      continue
    }

    return { error: `Unknown option: ${arg}` }
  }

  if (options.resume && options.backupFile) {
    return { error: "--resume continues the original rotation and cannot take --backup-file." }
  }

  return { data: options }
}

export function getRotateHelpText(): string {
  const command = chalk.bold("pnpm remit:rotate-encryption-key")
  const option = (value: string) => chalk.cyan(value)
  const heading = (value: string) => chalk.bold(value)
  const optionLine = (flag: string, description: string) =>
    `  ${option(flag.padEnd(22))} ${description}`

  return [
    heading("Usage"),
    `  ${command} ${option("[--backup-file <path>]")} ${option("[--dry-run]")} ${option("[--resume]")} ${option("[--help]")}`,
    "",
    heading("Purpose"),
    "  Rotate REMIT_ENCRYPTION_KEY across encrypted database columns and existing .remitbak archives.",
    "",
    heading("Options"),
    optionLine("--backup-file <path>", "Use an existing verified .remitbak pre-rotation backup."),
    optionLine(
      "--dry-run",
      "Verify keys, table counts, sample round-trips, and archive plan without writing."
    ),
    optionLine("--resume", "Continue from the latest incomplete key rotation audit trail."),
    optionLine("--help", "Print this help text."),
    "",
    heading("Key input"),
    "  Keys are never accepted on the command line. Interactive runs use masked prompts.",
    "  Unattended runs require REMIT_ALLOW_UNATTENDED_KEY_ROTATION=1 with REMIT_OLD_KEY and REMIT_NEW_KEY."
  ].join("\n")
}
