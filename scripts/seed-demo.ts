import * as p from "@clack/prompts"

import { loadCliEnvironment } from "./core/cli/bootstrap"

import { isDirectRun } from "./core/cli/isDirectRun"

import { parseSeedDemoArgs } from "./core/seedDemo/args"
import { hasExistingSeedableRows } from "./core/seedDemo/plan"
import {
  formatExistingRowsList,
  formatPlannedSummary,
  formatSamplePreview,
  formatSeedSizeLine,
  formatSettingsStatus,
  formatWrittenSummary,
  getSeedDemoHelpText,
  runSeedDemo,
  SeedDemoError
} from "./core/seedDemo/runSeedDemo"

export type { RunSeedDemoResult } from "./core/seedDemo/runSeedDemo"
export { runSeedDemo }

async function main(): Promise<void> {
  loadCliEnvironment()

  const parsed = parseSeedDemoArgs(process.argv.slice(2))

  if ("error" in parsed) {
    console.error(parsed.error)
    console.log("")
    console.log(getSeedDemoHelpText())
    process.exit(1)
  }

  if (parsed.data.help) {
    console.log(getSeedDemoHelpText())
    process.exit(0)
  }

  p.intro("Remit demo data seed")

  const [{ database, client }, schema] = await Promise.all([
    import("@/database"),
    import("@/database/schema")
  ])

  try {
    const result = await runSeedDemo(database, schema, parsed.data)

    if (parsed.data.dryRun) {
      p.note(
        [
          `Seed: ${result.plan.seed}`,
          formatSeedSizeLine(result.plan),
          `Base date: ${result.plan.baseDate.toISOString()}`,
          "",
          formatSettingsStatus(result.settingsAction),
          "",
          formatPlannedSummary(result.plan),
          "",
          formatSamplePreview(result.plan)
        ].join("\n"),
        "Dry run"
      )

      if (hasExistingSeedableRows(result.existingRows)) {
        p.note(formatExistingRowsList(result.existingRows), "Existing seedable rows")
      }

      p.outro("Dry run complete. No database writes were made.")
      process.exit(0)
    }

    p.outro(`Demo seed complete.\n${formatWrittenSummary(result.counts, result.settingsAction)}`)
    process.exit(0)
  } finally {
    await client.end()
  }
}

if (isDirectRun(import.meta.url)) {
  main().catch((error: unknown) => {
    p.cancel("Demo seed failed.")

    if (error instanceof SeedDemoError) {
      console.error(error.message)
    } else {
      console.error(error)
    }

    process.exit(1)
  })
}
