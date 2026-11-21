import { type RecurringInvoiceStatus } from "../schemas"

export type RecurringInvoiceStatusTransition =
  | { allowed: true; nextStatus: RecurringInvoiceStatus }
  | { allowed: false; reason: "terminal" | "same_status" | "not_allowed" }

const ALLOWED_TRANSITIONS: Record<RecurringInvoiceStatus, RecurringInvoiceStatus[]> = {
  active: ["paused", "cancelled", "completed"],
  paused: ["active", "cancelled"],
  completed: [],
  cancelled: []
}

// `completed` and `cancelled` are terminal, and deliberately so: a schedule that has finished its
// run or been called off keeps its history rather than being restarted, because restarting it would
// resume a `next_run_at` that is now in the past and generate a burst of back-dated invoices. The
// user creates a new schedule instead.
//
// `completed` is reachable only from `active` because it is written by the generation job when
// `shouldGenerateInvoice` reports the end condition met — never chosen by hand.
export function canTransitionRecurringInvoiceStatus(
  from: RecurringInvoiceStatus,
  to: RecurringInvoiceStatus
): RecurringInvoiceStatusTransition {
  if (from === to) return { allowed: false, reason: "same_status" }

  if (ALLOWED_TRANSITIONS[from].length === 0) return { allowed: false, reason: "terminal" }

  if (!ALLOWED_TRANSITIONS[from].includes(to)) return { allowed: false, reason: "not_allowed" }

  return { allowed: true, nextStatus: to }
}
