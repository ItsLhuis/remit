import { type ContractStatus } from "../schemas"

export type ContractTransitionReason = "same_status" | "not_allowed"

export type ContractStatusTransition =
  | { allowed: true; nextStatus: ContractStatus }
  | { allowed: false; reason: ContractTransitionReason }

// A contract moves forward only. `sent` is the point of no return: the counterparty has the document
// at `/c/[token]`, so it can never fall back to `draft`. `expired` and `terminated` are off-ramps
// rather than steps — `expired` is reached only from `sent` (an unsigned window that closed), while
// `terminated` is reachable from `sent` and from `signed`, because ending a contract that both sides
// executed is exactly what termination is for. No user action persists `expired` — it is derived at
// read time by services/contractExpiry.ts and only the scheduled job writes it, which is why the
// edge exists here.
const ALLOWED_TRANSITIONS: Record<ContractStatus, readonly ContractStatus[]> = {
  draft: ["sent"],
  sent: ["signed", "expired", "terminated"],
  signed: ["terminated"],
  expired: [],
  terminated: []
}

export function getNextContractStatuses(current: ContractStatus): ContractStatus[] {
  return [...ALLOWED_TRANSITIONS[current]]
}

export function canTransitionContractStatus(
  current: ContractStatus,
  next: ContractStatus
): ContractStatusTransition {
  if (next === current) return { allowed: false, reason: "same_status" }

  if (ALLOWED_TRANSITIONS[current].includes(next)) return { allowed: true, nextStatus: next }

  return { allowed: false, reason: "not_allowed" }
}

// The single definition of "editable", shared by the server-side guard in mutations.ts and the UI
// that hides the edit affordance, so the two can never disagree about which contracts are locked.
export function isContractEditable(status: ContractStatus): boolean {
  return status === "draft"
}
