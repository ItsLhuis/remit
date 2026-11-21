import { type ResetDataCliOptions } from "./types"

type ParseArgsResult = { data: ResetDataCliOptions } | { error: string }

export function parseResetDataArgs(argv: string[]): ParseArgsResult {
  const options: ResetDataCliOptions = {
    dryRun: false,
    help: false,
    yes: false
  }

  for (const arg of argv) {
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

    return { error: `Unknown option: ${arg}` }
  }

  return { data: options }
}
