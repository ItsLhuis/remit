import * as p from "@clack/prompts"

import { loadCliEnvironment } from "./core/cli/bootstrap"
import { isDirectRun } from "./core/cli/isDirectRun"
import { parseResetDataArgs } from "./core/resetData/args"
import {
  formatDeletedSummary,
  formatKeptSummary,
  formatQueueDrain,
  formatResetPreview,
  getResetDataHelpText,
  runResetData
} from "./core/resetData/runResetData"

export type { RunResetDataResult } from "./core/resetData/types"
export { runResetData }

async function main(): Promise<void> {
  loadCliEnvironment()

  const parsed = parseResetDataArgs(process.argv.slice(2))

  if ("error" in parsed) {
    console.error(parsed.error)
    console.log("")
    console.log(getResetDataHelpText())
    process.exit(1)
  }

  if (parsed.data.help) {
    console.log(getResetDataHelpText())
    process.exit(0)
  }

  p.intro("Remit instance data reset")

  const [{ database, client }, schema] = await Promise.all([
    import("@/database"),
    import("@/database/schema")
  ])

  try {
    const result = await runResetData(database, schema, parsed.data)

    if (parsed.data.dryRun) {
      p.note(formatResetPreview(result.plan), "Dry run")
      p.outro("Dry run complete. No database writes were made.")
      process.exit(0)
    }

    p.note(formatDeletedSummary(result.deletedCounts), "Deleted")
    p.note(formatKeptSummary(), "Kept")
    p.outro(`Instance data reset.\n${formatQueueDrain(result.queueDrain)}`)
    process.exit(0)
  } finally {
    await client.end()
  }
}

if (isDirectRun(import.meta.url)) {
  main().catch((error: unknown) => {
    p.cancel("Instance data reset failed.")
    console.error(error)
    process.exit(1)
  })
}
