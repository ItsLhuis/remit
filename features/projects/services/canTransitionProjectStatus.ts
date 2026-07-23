import { type ProjectStatus } from "../schemas"

export type ProjectTransitionReason = "same_status" | "terminal" | "not_allowed"

export type ProjectStatusTransition =
  | { allowed: true; nextStatus: ProjectStatus }
  | { allowed: false; reason: ProjectTransitionReason }

// `on_hold` is the only reversible state: a paused project is expected to resume, whereas
// `completed` and `cancelled` are terminal because downstream records (invoices, time entries)
// are settled against a finished project. Resuming abandoned work is a new project, not a
// reopened one.
const ALLOWED_TRANSITIONS: Record<ProjectStatus, readonly ProjectStatus[]> = {
  active: ["on_hold", "completed", "cancelled"],
  on_hold: ["active", "completed", "cancelled"],
  completed: [],
  cancelled: []
}

export function getNextProjectStatuses(current: ProjectStatus): ProjectStatus[] {
  return [...ALLOWED_TRANSITIONS[current]]
}

export function isTerminalProjectStatus(status: ProjectStatus): boolean {
  return ALLOWED_TRANSITIONS[status].length === 0
}

export function canTransitionProjectStatus(
  current: ProjectStatus,
  next: ProjectStatus
): ProjectStatusTransition {
  if (ALLOWED_TRANSITIONS[current].includes(next)) return { allowed: true, nextStatus: next }

  if (next === current) return { allowed: false, reason: "same_status" }

  if (isTerminalProjectStatus(current)) return { allowed: false, reason: "terminal" }

  return { allowed: false, reason: "not_allowed" }
}
