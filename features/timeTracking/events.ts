import { emit, type EventMap } from "@/lib/events"

export function emitTimeLogged(payload: EventMap["time.logged"]): Promise<void> {
  return emit("time.logged", payload)
}
