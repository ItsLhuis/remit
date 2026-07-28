import { emit, type EventMap } from "@/lib/events"

export function emitProposalCreated(payload: EventMap["proposal.created"]): Promise<void> {
  return emit("proposal.created", payload)
}

export function emitProposalUpdated(payload: EventMap["proposal.updated"]): Promise<void> {
  return emit("proposal.updated", payload)
}

export function emitProposalSent(payload: EventMap["proposal.sent"]): Promise<void> {
  return emit("proposal.sent", payload)
}

export function emitProposalDeleted(payload: EventMap["proposal.deleted"]): Promise<void> {
  return emit("proposal.deleted", payload)
}
