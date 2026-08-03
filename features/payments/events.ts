import { emit, type EventMap } from "@/lib/events"

export function emitPaymentReceived(payload: EventMap["payment.received"]): Promise<void> {
  return emit("payment.received", payload)
}

// A twin of the emitter in `features/invoices/events.ts`, not an import of it: this feature must not
// depend on `features/invoices`, which already depends on this one (see `revalidatePaymentPaths`).
// Only the paths that own the user-facing action emit it — `recordInvoiceSettlement` reports
// `settled` back to `markInvoicePaid` and stays quiet, so an invoice settled that way is announced
// exactly once, by the invoice side.
export function emitInvoiceSettled(payload: EventMap["invoice.paid"]): Promise<void> {
  return emit("invoice.paid", payload)
}
