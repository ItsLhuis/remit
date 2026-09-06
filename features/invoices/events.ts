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

export function emitInvoiceOverdue(payload: EventMap["invoice.overdue"]): Promise<void> {
  return emit("invoice.overdue", payload)
}

export function emitInvoiceLateFeeApplied(
  payload: EventMap["invoice.late_fee_applied"]
): Promise<void> {
  return emit("invoice.late_fee_applied", payload)
}

export function emitInvoiceReminderSent(payload: EventMap["invoice.reminder_sent"]): Promise<void> {
  return emit("invoice.reminder_sent", payload)
}
