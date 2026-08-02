import { type InvoiceStatus } from "../schemas"

export type InvoiceTransitionReason = "same_status" | "not_allowed"

export type InvoiceStatusTransition =
  | { allowed: true; nextStatus: InvoiceStatus }
  | { allowed: false; reason: InvoiceTransitionReason }

// An invoice moves forward only, over the three *stored* statuses. `sent` is the point of no
// return: the client holds a numbered document, so it can never fall back to `draft` and be
// rewritten underneath them, and `paid` is terminal because a settled invoice is a record of money
// received. Correcting an issued invoice is a credit note, not a status change.
//
// `overdue` and `partially_paid` are absent on purpose — they are computed views over this machine
// (invoiceStatusView.ts), never stored, so they are not reachable transitions.
const ALLOWED_TRANSITIONS: Record<InvoiceStatus, readonly InvoiceStatus[]> = {
  draft: ["sent"],
  sent: ["paid"],
  paid: []
}

export function getNextInvoiceStatuses(current: InvoiceStatus): InvoiceStatus[] {
  return [...ALLOWED_TRANSITIONS[current]]
}

export function canTransitionInvoiceStatus(
  current: InvoiceStatus,
  next: InvoiceStatus
): InvoiceStatusTransition {
  if (next === current) return { allowed: false, reason: "same_status" }

  if (ALLOWED_TRANSITIONS[current].includes(next)) return { allowed: true, nextStatus: next }

  return { allowed: false, reason: "not_allowed" }
}

// The single definition of "editable" shared by the server-side guard in mutations.ts, the edit
// route's redirect, and the UI that hides the edit affordance, so the three can never disagree
// about which invoices are locked.
export function isInvoiceEditable(status: InvoiceStatus): boolean {
  return status === "draft"
}
