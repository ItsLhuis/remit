import * as p from "@clack/prompts"

import { exitOnCancel } from "../cli/exitOnCancel"

import { RestoreCliError } from "./errors"
import { type ArchiveSchemaComparison } from "./schemaGate"

export async function confirmDestructiveRestore(input: {
  allowUnattended: boolean
  databaseName: string
  snapshotPath: string
  yes: boolean
}): Promise<void> {
  if (input.yes) {
    if (input.allowUnattended) return

    throw new RestoreCliError(
      "Refusing restore: --yes requires REMIT_ALLOW_UNATTENDED_RESTORE=1. Set both for unattended restore, or rerun without --yes and complete the typed confirmations.",
      "unattended-restore-not-allowed"
    )
  }

  const databaseConfirmation = await p.text({
    message: `Type the database name to restore into (${input.databaseName})`,
    validate(value) {
      return value === input.databaseName ? undefined : "Database name must match exactly."
    }
  })

  exitOnCancel(databaseConfirmation, "Restore cancelled. No restore was applied.")

  const snapshotConfirmation = await p.text({
    message: "Type the pre-restore snapshot path",
    validate(value) {
      return value === input.snapshotPath ? undefined : "Snapshot path must match exactly."
    }
  })

  exitOnCancel(snapshotConfirmation, "Restore cancelled. No restore was applied.")
}

// Only an older archive reaches this: `runRestore.ts` refuses a newer one outright. An unattended
// run cannot answer a prompt, so it must carry the flag instead, and is refused without it rather
// than migrating a database nobody acknowledged was older. Returns false when the operator declines.
export async function confirmOlderArchiveSchema(input: {
  acceptOlderSchema: boolean
  comparison: Extract<ArchiveSchemaComparison, { kind: "older" }>
  yes: boolean
}): Promise<boolean> {
  const warning = `This archive was taken at schema migration ${input.comparison.archiveMigration}; this build is at ${input.comparison.currentMigration}. The restored database is migrated forward to ${input.comparison.currentMigration}, and that cannot be undone except from the pre-restore snapshot.`

  if (input.acceptOlderSchema) {
    p.log.warn(warning)

    return true
  }

  if (input.yes) {
    throw new RestoreCliError(
      `Refusing restore: ${warning} Re-run with --accept-older-schema to acknowledge it.`,
      "archive-schema-older-unacknowledged"
    )
  }

  p.log.warn(warning)

  const confirmed = await p.confirm({
    message: "Restore this older archive and migrate it forward?",
    initialValue: false
  })

  return exitOnCancel(confirmed, "Restore cancelled. No restore was applied.")
}
