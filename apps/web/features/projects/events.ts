import { emit, type EventMap } from "@/lib/events"

export function emitProjectCreated(payload: EventMap["project.created"]): Promise<void> {
  return emit("project.created", payload)
}

export function emitProjectUpdated(payload: EventMap["project.updated"]): Promise<void> {
  return emit("project.updated", payload)
}

export function emitProjectDeleted(payload: EventMap["project.deleted"]): Promise<void> {
  return emit("project.deleted", payload)
}

export function emitProjectStatusChanged(
  payload: EventMap["project.status_changed"]
): Promise<void> {
  return emit("project.status_changed", payload)
}
