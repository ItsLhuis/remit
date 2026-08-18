import * as p from "@clack/prompts"

import { exitOnCancel } from "../cli/exitOnCancel"

export async function confirmDestructiveReset(confirmationPhrase: string): Promise<void> {
  // A typed phrase rather than a yes/no: unlike `--reseed`, a reset puts nothing back in place of
  // what it removes, and there is no undo short of a restore from backup.
  const confirmation = await p.text({
    message: `Type the instance name to empty it (${confirmationPhrase})`,
    validate(value) {
      return value === confirmationPhrase ? undefined : "Value must match exactly."
    }
  })

  exitOnCancel(confirmation, "Reset cancelled. No data was deleted.")
}
