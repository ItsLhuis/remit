import { emit, type EventMap } from "@/lib/events"

export function emitRecurringInvoiceGenerated(
  payload: EventMap["recurring.invoice_generated"]
): Promise<void> {
  return emit("recurring.invoice_generated", payload)
}

export function emitRetainerPoolExhausted(
  payload: EventMap["retainer.pool_exhausted"]
): Promise<void> {
  return emit("retainer.pool_exhausted", payload)
}
