import { describe, expect, test } from "vitest"

import { TASK_STATUS_VALUES, type TaskStatus } from "../../schemas"
import { canTransitionTaskStatus, getNextTaskStatuses } from "../canTransitionTaskStatus"

const distinctPairs: ReadonlyArray<[TaskStatus, TaskStatus]> = TASK_STATUS_VALUES.flatMap(
  (current) =>
    TASK_STATUS_VALUES.filter((next) => next !== current).map((next): [TaskStatus, TaskStatus] => [
      current,
      next
    ])
)

describe("canTransitionTaskStatus", () => {
  test.each(distinctPairs)("allows %s to %s", (current, next) => {
    expect(canTransitionTaskStatus(current, next)).toEqual({ allowed: true, nextStatus: next })
  })

  test("rejects a no-op transition as same_status", () => {
    expect(canTransitionTaskStatus("todo", "todo")).toEqual({
      allowed: false,
      reason: "same_status"
    })
  })
})

describe("getNextTaskStatuses", () => {
  test("returns the other four statuses for in_progress", () => {
    expect(getNextTaskStatuses("in_progress")).toEqual(["backlog", "todo", "done", "cancelled"])
  })

  test("returns every other status for backlog", () => {
    expect(getNextTaskStatuses("backlog")).toEqual(["todo", "in_progress", "done", "cancelled"])
  })
})
