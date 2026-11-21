import { eq } from "drizzle-orm"

import { on } from "@/lib/events"

import { database } from "@/database"
import { timeEntries } from "@/database/schema"

import { type ActivityRecord, findProjectName, record } from "./record"

const SECONDS_PER_HOUR = 3600

export function subscribeTimeEntryActivity(): void {
  on("time.logged", ({ timeEntryId, projectId, durationSeconds }) =>
    record("time.logged", () => buildTimeLogged(timeEntryId, projectId, durationSeconds))
  )
}

async function buildTimeLogged(
  timeEntryId: string,
  projectId: string,
  durationSeconds: number
): Promise<ActivityRecord | null> {
  const [entry, project] = await Promise.all([
    database.query.timeEntries.findFirst({
      where: eq(timeEntries.id, timeEntryId),
      columns: { id: true }
    }),
    findProjectName(projectId)
  ])

  if (!entry || project === null) return null

  // Rounded to one decimal here rather than in the message, because ICU can cap the fraction digits
  // it prints but cannot round the stored value, and the feed must not imply a precision the entry
  // does not have.
  const hours = Math.round((durationSeconds / SECONDS_PER_HOUR) * 10) / 10

  return {
    entityType: "time_entry",
    entityId: timeEntryId,
    action: "logged",
    messageKey: "activity.messages.timeLogged",
    messageArgs: { hours, project }
  }
}
