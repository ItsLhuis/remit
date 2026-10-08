import { on } from "@/lib/events"

import { type ActivityRecord, findProjectName, record } from "./record"

export function subscribeProjectActivity(): void {
  on("project.created", ({ projectId }) =>
    record("project.created", () => buildProjectCreated(projectId))
  )

  on("project.status_changed", ({ projectId, to }) =>
    record("project.status_changed", () => buildProjectStatusChanged(projectId, to))
  )
}

async function buildProjectCreated(projectId: string): Promise<ActivityRecord | null> {
  const name = await findProjectName(projectId)

  if (name === null) return null

  return {
    entityType: "project",
    entityId: projectId,
    action: "created",
    messageKey: "activity.messages.projectCreated",
    messageArgs: { name }
  }
}

async function buildProjectStatusChanged(
  projectId: string,
  status: string
): Promise<ActivityRecord | null> {
  const name = await findProjectName(projectId)

  if (name === null) return null

  // `status` travels raw. The message resolves it through an ICU `select`, so the stored row stays
  // locale-independent and a status added to the enum degrades to the `other` arm instead of
  // freezing yesterday's English into the history.
  return {
    entityType: "project",
    entityId: projectId,
    action: "status_changed",
    messageKey: "activity.messages.projectStatusChanged",
    messageArgs: { name, status }
  }
}
