import { logger } from "@/lib/logger"

import { getMigrationDrift } from "./queries"

// What a developer running a database behind on migrations actually sees without this: nothing. The
// handlers that hit a missing table catch and log their own failure, so the screen shows an ordinary
// empty state and the cause is several layers away from the symptom. The same drift is on
// /settings/system for an operator, which nobody opens before debugging.
//
// Never throws and never blocks the boot: a development server must still start against a database
// that is down, which is also the reason the caller does not await it.
export async function warnAboutMigrationDrift(): Promise<void> {
  try {
    const { drift, appliedCount, expectedCount } = await getMigrationDrift()

    if (drift === "pending") {
      logger.warn(
        { action: "startup.migrations", appliedCount, expectedCount },
        `The database is behind on migrations: ${expectedCount - appliedCount} pending. Run pnpm database:migrate.`
      )

      return
    }

    if (drift === "ahead") {
      logger.warn(
        { action: "startup.migrations", appliedCount, expectedCount },
        "The database carries migrations this build does not know about. Check out the matching revision rather than migrating."
      )
    }
  } catch (error) {
    logger.warn(
      { action: "startup.migrations", err: error },
      "Could not check whether the database is up to date on migrations"
    )
  }
}
