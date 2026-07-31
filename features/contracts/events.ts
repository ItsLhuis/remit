import { emit, type EventMap } from "@/lib/events"

export function emitContractCreated(payload: EventMap["contract.created"]): Promise<void> {
  return emit("contract.created", payload)
}

export function emitContractUpdated(payload: EventMap["contract.updated"]): Promise<void> {
  return emit("contract.updated", payload)
}

export function emitContractSent(payload: EventMap["contract.sent"]): Promise<void> {
  return emit("contract.sent", payload)
}

export function emitContractTerminated(payload: EventMap["contract.terminated"]): Promise<void> {
  return emit("contract.terminated", payload)
}

export function emitContractDeleted(payload: EventMap["contract.deleted"]): Promise<void> {
  return emit("contract.deleted", payload)
}
