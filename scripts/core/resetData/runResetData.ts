import * as p from "@clack/prompts"

import chalk from "chalk"

import { writeOperationalAudit } from "../audit/operationalAudit"
import { deleteDomainRows, type DomainDeleteCounts } from "../domainData/deleteDomainRows"
import { DOMAIN_DATA_INVENTORY } from "../domainData/inventory"

import { parseResetDataArgs } from "./args"
import { confirmDestructiveReset } from "./confirm"
import { buildResetDataPlan } from "./plan"
import { drainQueuedJobs } from "./queueDrain"
import {
  type QueueDrainOutcome,
  type ResetDataCliOptions,
  type ResetDataPlan,
  type ResetDataTablePreview,
  type RunResetDataResult
} from "./types"

export { parseResetDataArgs }

type Database = typeof import("@/database").database
type Schema = typeof import("@/database/schema")

const CLI_USER_AGENT = "cli/reset-data"

export async function runResetData(
  database: Database,
  schema: Schema,
  options: ResetDataCliOptions
): Promise<RunResetDataResult> {
  const plan = await buildResetDataPlan(database, schema)

  if (options.dryRun) {
    return {
      deletedCounts: {},
      plan,
      queueDrain: { status: "skipped" },
      wrote: false
    }
  }

  p.note(formatResetPreview(plan), "Reset plan")

  if (!options.yes) {
    await confirmDestructiveReset(plan.confirmationPhrase)
  }

  const spinner = p.spinner()
  spinner.start("Deleting domain data...")

  try {
    const deletedCounts = await database.transaction(async (transaction) => {
      const counts = await deleteDomainRows(transaction, schema, "reset")

      // Inside the transaction with the deletes it records, so a rollback takes the entry with it
      // and no entry can ever claim a reset that did not happen. The queue drain below is
      // deliberately absent from the metadata: it runs after the commit, and `audit_logs` is
      // insert-only, so there is nothing to amend it with afterwards.
      await writeOperationalAudit({
        database: transaction,
        schema,
        event: "instance.reset_data.completed",
        metadata: {
          deletedCounts: counts,
          keptTables: keptTableNames()
        },
        userAgent: CLI_USER_AGENT
      })

      return counts
    })

    spinner.stop("Domain data deleted.")

    return {
      deletedCounts,
      plan,
      queueDrain: await drainQueuedJobs(),
      wrote: true
    }
  } catch (error) {
    spinner.stop("Reset failed.")
    throw error
  }
}

function keptTableNames(): string[] {
  return DOMAIN_DATA_INVENTORY.filter((entry) => entry.reset === "keep").map((entry) => entry.table)
}

export function formatResetPreview(plan: ResetDataPlan): string {
  const deleted = plan.previews.filter((preview) => preview.decision === "delete")
  const kept = plan.previews.filter((preview) => preview.decision === "keep")

  return [
    `${chalk.bold("Delete")} (${plan.deletableRowTotal} rows)`,
    ...deleted.map(formatPreviewLine),
    "",
    `${chalk.bold("Keep")}`,
    ...kept.map(formatPreviewLine)
  ].join("\n")
}

// Table and count only. The per-table reason lives in `--help`, where it has the full terminal
// width; inside a clack note box it wraps onto a second line and the preview stops being scannable
// at exactly the moment the operator is deciding whether to go ahead.
function formatPreviewLine(preview: ResetDataTablePreview): string {
  // Padded before colouring: chalk wraps the string in escape codes that `padEnd` would count.
  const label = preview.table.padEnd(24)

  return `    ${chalk.bold(label)} ${String(preview.rows).padStart(7)}`
}

export function formatDeletedSummary(counts: DomainDeleteCounts): string {
  const entries = Object.entries(counts).filter(([, value]) => value > 0)

  if (entries.length === 0) return "No domain rows were present to delete."

  return entries.map(([table, value]) => `  ${table.padEnd(24)} ${value}`).join("\n")
}

export function formatKeptSummary(): string {
  return keptTableNames()
    .map((table) => `  ${table}`)
    .join("\n")
}

export function formatQueueDrain(outcome: QueueDrainOutcome): string {
  if (outcome.status === "drained") return "Queued jobs: drained."
  if (outcome.status === "skipped") return "Queued jobs: not touched."

  return `Queued jobs: could not be drained (${outcome.reason}). Jobs referring to deleted rows may still be scheduled.`
}

export function getResetDataHelpText(): string {
  const command = chalk.bold("pnpm remit:reset-data")
  const option = (value: string) => chalk.cyan(value)
  const heading = (value: string) => chalk.bold(value)
  const optionLine = (flag: string, description: string) =>
    `  ${option(flag.padEnd(16))} ${description}`

  return [
    heading("Usage"),
    `  ${command} ${option("[--dry-run]")} ${option("[--yes]")} ${option("[--help]")}`,
    "",
    heading("Purpose"),
    "  Return a configured Remit instance to zero domain data, keeping the operator account,",
    "  the organization, and the instance configuration exactly as they are.",
    "",
    heading("Options"),
    optionLine("--dry-run", "Report what would be deleted without writing anything."),
    optionLine("--yes", "Skip the typed confirmation. For scripted use only."),
    optionLine("--help", "Print this help text."),
    "",
    heading("Reset Inventory"),
    formatResetInventoryHelp()
  ].join("\n")
}

function formatResetInventoryHelp(): string {
  const deleted = DOMAIN_DATA_INVENTORY.filter((entry) => entry.reset === "delete")
  const kept = DOMAIN_DATA_INVENTORY.filter((entry) => entry.reset === "keep")

  return [
    `  ${chalk.red("delete")}`,
    ...deleted.map(formatInventoryItem),
    "",
    `  ${chalk.green("keep")}`,
    ...kept.map(formatInventoryItem)
  ].join("\n")
}

function formatInventoryItem(entry: (typeof DOMAIN_DATA_INVENTORY)[number]): string {
  return `    ${chalk.bold(entry.table.padEnd(24))} ${entry.reason}`
}
