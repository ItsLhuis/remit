import { emit, type EventMap } from "@/lib/events"

export function emitLeadCreated(payload: EventMap["lead.created"]): Promise<void> {
  return emit("lead.created", payload)
}

export function emitLeadUpdated(payload: EventMap["lead.updated"]): Promise<void> {
  return emit("lead.updated", payload)
}

export function emitLeadDeleted(payload: EventMap["lead.deleted"]): Promise<void> {
  return emit("lead.deleted", payload)
}

export function emitLeadStageChanged(payload: EventMap["lead.stage_changed"]): Promise<void> {
  return emit("lead.stage_changed", payload)
}

export function emitLeadConverted(payload: EventMap["lead.converted"]): Promise<void> {
  return emit("lead.converted", payload)
}
