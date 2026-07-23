import { type LeadStatus } from "../schemas"

export type LeadTransitionReason = "same_status" | "terminal" | "not_allowed"

export type LeadStatusTransition =
  | { allowed: true; nextStatus: LeadStatus }
  | { allowed: false; reason: LeadTransitionReason }

// A lead may only step one stage forward or one stage back, never skip ahead: a "qualified" lead
// must have been contacted, and a proposal must have been sent before it can be won or lost, so
// the pipeline stage always reflects work that actually happened. `won` and `lost` are terminal
// because a decided lead is an outcome, not a stage to reopen — a revived prospect is a new lead.
// Widening a row here silently weakens that guarantee everywhere the pipeline is reported on.
const ALLOWED_TRANSITIONS: Record<LeadStatus, readonly LeadStatus[]> = {
  new: ["contacted"],
  contacted: ["new", "qualified"],
  qualified: ["contacted", "proposal_sent"],
  proposal_sent: ["qualified", "won", "lost"],
  won: [],
  lost: []
}

export function getNextLeadStatuses(current: LeadStatus): LeadStatus[] {
  return [...ALLOWED_TRANSITIONS[current]]
}

export function isTerminalLeadStatus(status: LeadStatus): boolean {
  return ALLOWED_TRANSITIONS[status].length === 0
}

export function canTransitionLeadStatus(
  current: LeadStatus,
  next: LeadStatus
): LeadStatusTransition {
  if (ALLOWED_TRANSITIONS[current].includes(next)) return { allowed: true, nextStatus: next }

  if (next === current) return { allowed: false, reason: "same_status" }

  if (isTerminalLeadStatus(current)) return { allowed: false, reason: "terminal" }

  return { allowed: false, reason: "not_allowed" }
}
