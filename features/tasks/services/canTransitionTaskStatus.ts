import { TASK_STATUS_VALUES, type TaskStatus } from "../schemas"

export type TaskTransitionReason = "same_status" | "not_allowed"

export type TaskStatusTransition =
  | { allowed: true; nextStatus: TaskStatus }
  | { allowed: false; reason: TaskTransitionReason }

const ALLOWED_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  backlog: TASK_STATUS_VALUES.filter((status) => status !== "backlog"),
  todo: TASK_STATUS_VALUES.filter((status) => status !== "todo"),
  in_progress: TASK_STATUS_VALUES.filter((status) => status !== "in_progress"),
  done: TASK_STATUS_VALUES.filter((status) => status !== "done"),
  cancelled: TASK_STATUS_VALUES.filter((status) => status !== "cancelled")
}

export function getNextTaskStatuses(current: TaskStatus): TaskStatus[] {
  return [...ALLOWED_TRANSITIONS[current]]
}

export function canTransitionTaskStatus(
  current: TaskStatus,
  next: TaskStatus
): TaskStatusTransition {
  if (next === current) return { allowed: false, reason: "same_status" }

  if (ALLOWED_TRANSITIONS[current].includes(next)) return { allowed: true, nextStatus: next }

  return { allowed: false, reason: "not_allowed" }
}
