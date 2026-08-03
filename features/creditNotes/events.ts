import { emit, type EventMap } from "@/lib/events"

export function emitCreditNoteIssued(payload: EventMap["credit_note.issued"]): Promise<void> {
  return emit("credit_note.issued", payload)
}

export function emitCreditNoteDeleted(payload: EventMap["credit_note.deleted"]): Promise<void> {
  return emit("credit_note.deleted", payload)
}
