import * as p from "@clack/prompts"

import { exitOnCancel } from "../cli/exitOnCancel"

import { RestoreCliError } from "./errors"

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
