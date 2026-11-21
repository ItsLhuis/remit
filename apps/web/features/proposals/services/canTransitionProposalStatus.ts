import { type ProposalStatus } from "../schemas"

export type ProposalTransitionReason = "same_status" | "not_allowed"

export type ProposalStatusTransition =
  | { allowed: true; nextStatus: ProposalStatus }
  | { allowed: false; reason: ProposalTransitionReason }

// A proposal moves forward only. `sent` is the point of no return: the client has seen the document,
// so it can never fall back to `draft` and be rewritten underneath them, and `accepted`/`rejected`
// are terminal because the response is a record of what the client actually did. Reopening is a new
// proposal, not a status change.
const ALLOWED_TRANSITIONS: Record<ProposalStatus, readonly ProposalStatus[]> = {
  draft: ["sent"],
  sent: ["accepted", "rejected"],
  accepted: [],
  rejected: []
}

export function getNextProposalStatuses(current: ProposalStatus): ProposalStatus[] {
  return [...ALLOWED_TRANSITIONS[current]]
}

export function canTransitionProposalStatus(
  current: ProposalStatus,
  next: ProposalStatus
): ProposalStatusTransition {
  if (next === current) return { allowed: false, reason: "same_status" }

  if (ALLOWED_TRANSITIONS[current].includes(next)) return { allowed: true, nextStatus: next }

  return { allowed: false, reason: "not_allowed" }
}

// The single definition of "editable" shared by the server-side guard in mutations.ts and the UI
// that hides the edit affordance, so the two can never disagree about which proposals are locked.
export function isProposalEditable(status: ProposalStatus): boolean {
  return status === "draft"
}
