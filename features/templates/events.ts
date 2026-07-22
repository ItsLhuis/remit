import { emit, type EventMap } from "@/lib/events"

export function emitTemplateCreated(payload: EventMap["template.created"]): Promise<void> {
  return emit("template.created", payload)
}

export function emitTemplateUpdated(payload: EventMap["template.updated"]): Promise<void> {
  return emit("template.updated", payload)
}

export function emitTemplateDeleted(payload: EventMap["template.deleted"]): Promise<void> {
  return emit("template.deleted", payload)
}
