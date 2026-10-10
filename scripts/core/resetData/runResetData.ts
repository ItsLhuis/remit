import * as p from "@clack/prompts"

import chalk from "chalk"

import { writeOperationalAudit } from "../audit/operationalAudit"
import {
  deleteDomainRows,
  loadObjectDeletions,
  type DomainDeleteCounts
} from "../domainData/deleteDomainRows"
import { DOMAIN_DATA_INVENTORY } from "../domainData/inventory"
import { type NumberingCounters } from "../domainData/numbering"
import { rewindSeededNumbering } from "../domainData/numberingCounters"

import { parseResetDataArgs } from "./args"
import { confirmDestructiveReset } from "./confirm"
import { buildResetDataPlan } from "./plan"
import { drainQueuedJobs } from "./queueDrain"
import {
  type QueueDrainOutcome,
  type ResetDataCliOptions,
  type ResetDataPlan,
  type ResetDataTablePreview,
  type RunResetDataResult,
  type StorageDrainOutcome
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
      numberingRewound: {},
      plan,
      queueDrain: { status: "skipped" },
      storage: { queued: 0, deleted: 0 },
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
    // Repeatable read because the uploads a reset releases are the difference between two reads of
    // every reference (`deleteDomainRows`), and only one snapshot keeps them consistent.
    const outcome = await database.transaction(
      async (transaction) => {
        const deleted = await deleteDomainRows(transaction, schema, "reset")
        const numberingRewound = await rewindSeededNumbering(transaction, schema)

        // Inside the transaction with the deletes it records, so a rollback takes the entry with it
        // and no entry can ever claim a reset that did not happen. The queue and object drains
        // below are deliberately absent from the metadata: they run after the commit, and
        // `audit_logs` is insert-only, so there is nothing to amend it with afterwards.
        await writeOperationalAudit({
          database: transaction,
          schema,
          event: "instance.reset_data.completed",
          metadata: {
            deletedCounts: deleted.counts,
            storageObjects: deleted.storageObjects,
            numberingRewound,
            keptTables: keptTableNames()
          },
          userAgent: CLI_USER_AGENT
        })

        return { ...deleted, numberingRewound }
      },
      { isolationLevel: "repeatable read" }
    )

    spinner.stop("Domain data deleted.")

    const { drainObjectDeletions } = await loadObjectDeletions()
    const storageDrain = await drainObjectDeletions({ ids: outcome.deletionIds })

    return {
      deletedCounts: outcome.counts,
      numberingRewound: outcome.numberingRewound,
      plan,
      queueDrain: await drainQueuedJobs(),
      storage: { queued: outcome.storageObjects, deleted: storageDrain.deleted },
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

// The objects the deleted rows owned, removed after the commit. What the store refused stays queued
// and the worker's hourly `storage.deletion.sweep` finishes it, so a partial count is not a failure.
export function formatStorageDrain(outcome: StorageDrainOutcome): string {
  if (outcome.queued === 0) return "Stored files: none to remove."

  if (outcome.deleted === outcome.queued) return `Stored files: ${outcome.deleted} removed.`

  return `Stored files: ${outcome.deleted} of ${outcome.queued} removed; the worker removes the rest.`
}

export function formatNumberingRewind(rewound: Partial<NumberingCounters>): string {
  const entries = Object.entries(rewound)

  if (entries.length === 0) return "Document numbering: unchanged."

  return `Document numbering: ${entries.map(([name, value]) => `${name} back to ${value}`).join(", ")}.`
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
