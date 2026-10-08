import { eq } from "drizzle-orm"

import { logger } from "@/lib/logger"

import { database } from "@/database"
import { activityLogs, invoices, projects } from "@/database/schema"

import { type ActivityEntityType, type ActivityMessageArgs } from "../schemas"
import { type ActivityMessageKey } from "../types"

export type ActivityRecord = {
  entityType: ActivityEntityType
  entityId: string
  action: string
  messageKey: ActivityMessageKey
  messageArgs: ActivityMessageArgs
}

export async function record(
  event: string,
  build: () => Promise<ActivityRecord | null>
): Promise<void> {
  try {
    const entry = await build()

    // A builder returns null when the row the event names is already gone, which a delete racing an
    // emit can produce. Writing an entry with no label would put an untranslatable blank in the feed.
    if (!entry) return

    await database.insert(activityLogs).values(entry)
  } catch (error) {
    // Swallowed rather than rethrown, as `.agents/rules/events.md` requires: `lib/events/bus.ts`
    // awaits handlers inside the emitting action's write path, so letting this escape would fail a
    // real invoice or payment for the sake of a history entry.
    logger.error({ action: "activityLog.record", event, err: error }, "Activity log write failed")
  }
}

export async function findProjectName(projectId: string): Promise<string | null> {
  const row = await database.query.projects.findFirst({
    where: eq(projects.id, projectId),
    columns: { name: true }
  })

  return row?.name ?? null
}

export async function findInvoiceNumber(invoiceId: string): Promise<string | null> {
  const row = await database.query.invoices.findFirst({
    where: eq(invoices.id, invoiceId),
    columns: { number: true }
  })

  return row?.number ?? null
}
