import { emit, type EventMap } from "@/lib/events"

export function emitInvoiceCreated(payload: EventMap["invoice.created"]): Promise<void> {
  return emit("invoice.created", payload)
}

export function emitInvoiceUpdated(payload: EventMap["invoice.updated"]): Promise<void> {
  return emit("invoice.updated", payload)
}

export function emitInvoiceSent(payload: EventMap["invoice.sent"]): Promise<void> {
  return emit("invoice.sent", payload)
}

export function emitInvoicePaid(payload: EventMap["invoice.paid"]): Promise<void> {
  return emit("invoice.paid", payload)
}

export function emitInvoiceDeleted(payload: EventMap["invoice.deleted"]): Promise<void> {
  return emit("invoice.deleted", payload)
}
