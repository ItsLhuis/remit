import { emit, type EventMap } from "@/lib/events"

export function emitTaskCreated(payload: EventMap["task.created"]): Promise<void> {
  return emit("task.created", payload)
}

export function emitTaskUpdated(payload: EventMap["task.updated"]): Promise<void> {
  return emit("task.updated", payload)
}

export function emitTaskDeleted(payload: EventMap["task.deleted"]): Promise<void> {
  return emit("task.deleted", payload)
}

export function emitTaskStatusChanged(payload: EventMap["task.status_changed"]): Promise<void> {
  return emit("task.status_changed", payload)
}
