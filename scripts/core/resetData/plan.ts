import {
  collectDeletableUploadIds,
  countTableRows,
  type DomainDeleteDatabase
} from "../domainData/deleteDomainRows"
import { DOMAIN_DATA_INVENTORY } from "../domainData/inventory"

import { type ResetDataPlan, type ResetDataTablePreview } from "./types"

type Database = typeof import("@/database").database
type Schema = typeof import("@/database/schema")
type PlanDatabase = DomainDeleteDatabase & Pick<Database, "query">

const FALLBACK_CONFIRMATION_PHRASE = "DELETE"

export async function buildResetDataPlan(
  database: PlanDatabase,
  schema: Schema
): Promise<ResetDataPlan> {
  const deletableUploadIds = await collectDeletableUploadIds(database)
  const previews: ResetDataTablePreview[] = []

  for (const entry of DOMAIN_DATA_INVENTORY) {
    previews.push({
      decision: entry.reset,
      reason: entry.reason,
      // `uploads` is the one table a reset empties partially, so its preview counts the rows the
      // deleted documents pointed at rather than every row in the table.
      rows:
        entry.key === "uploads"
          ? deletableUploadIds.length
          : await countTableRows(database, schema[entry.key]),
      table: entry.table
    })
  }

  const deletableRowTotal = previews
    .filter((preview) => preview.decision === "delete")
    .reduce((total, preview) => total + preview.rows, 0)

  return {
    confirmationPhrase: await getConfirmationPhrase(database),
    deletableRowTotal,
    previews
  }
}

async function getConfirmationPhrase(database: PlanDatabase): Promise<string> {
  const settingsRow = await database.query.settings.findFirst({
    columns: { businessName: true }
  })

  return settingsRow?.businessName?.trim() || FALLBACK_CONFIRMATION_PHRASE
}
