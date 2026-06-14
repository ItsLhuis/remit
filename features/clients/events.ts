import { emit, type EventMap } from "@/lib/events"

export function emitClientCreated(payload: EventMap["client.created"]): Promise<void> {
  return emit("client.created", payload)
}

export function emitClientUpdated(payload: EventMap["client.updated"]): Promise<void> {
  return emit("client.updated", payload)
}

export function emitClientDeleted(payload: EventMap["client.deleted"]): Promise<void> {
  return emit("client.deleted", payload)
}
