import { describe, expect, test } from "vitest"

import { PROJECT_STATUS_VALUES, type ProjectStatus } from "../../schemas"
import {
  canTransitionProjectStatus,
  getNextProjectStatuses,
  isTerminalProjectStatus
} from "../canTransitionProjectStatus"

const ALLOWED_PAIRS: ReadonlyArray<[ProjectStatus, ProjectStatus]> = [
  ["active", "on_hold"],
  ["active", "completed"],
  ["active", "cancelled"],
  ["on_hold", "active"],
  ["on_hold", "completed"],
  ["on_hold", "cancelled"]
]

function isAllowedPair(current: ProjectStatus, next: ProjectStatus): boolean {
  return ALLOWED_PAIRS.some(([from, to]) => from === current && to === next)
}

describe("canTransitionProjectStatus", () => {
  test.each(ALLOWED_PAIRS)("allows %s to %s", (current, next) => {
    const result = canTransitionProjectStatus(current, next)

    expect(result).toEqual({ allowed: true, nextStatus: next })
  })

  test("rejects every transition outside the allowed set across all pairs", () => {
    const rejected = PROJECT_STATUS_VALUES.flatMap((current) =>
      PROJECT_STATUS_VALUES.filter((next) => !isAllowedPair(current, next)).map((next) =>
        canTransitionProjectStatus(current, next)
      )
    )

    expect(rejected.every((result) => result.allowed === false)).toBe(true)
  })

  test("reports same_status when the target equals the current status", () => {
    const result = canTransitionProjectStatus("active", "active")

    expect(result).toEqual({ allowed: false, reason: "same_status" })
  })

  test("reports terminal when transitioning out of a completed project", () => {
    const result = canTransitionProjectStatus("completed", "active")

    expect(result).toEqual({ allowed: false, reason: "terminal" })
  })

  test("reports terminal when transitioning out of a cancelled project", () => {
    const result = canTransitionProjectStatus("cancelled", "active")

    expect(result).toEqual({ allowed: false, reason: "terminal" })
  })
})

describe("getNextProjectStatuses", () => {
  test("returns the reachable statuses for an active project", () => {
    expect(getNextProjectStatuses("active")).toEqual(["on_hold", "completed", "cancelled"])
  })

  test("returns the reachable statuses for an on-hold project", () => {
    expect(getNextProjectStatuses("on_hold")).toEqual(["active", "completed", "cancelled"])
  })

  test("returns no transitions for terminal statuses", () => {
    expect(getNextProjectStatuses("completed")).toEqual([])
    expect(getNextProjectStatuses("cancelled")).toEqual([])
  })
})

describe("isTerminalProjectStatus", () => {
  test("treats completed and cancelled as terminal and the rest as non-terminal", () => {
    expect(isTerminalProjectStatus("completed")).toBe(true)
    expect(isTerminalProjectStatus("cancelled")).toBe(true)
    expect(isTerminalProjectStatus("active")).toBe(false)
    expect(isTerminalProjectStatus("on_hold")).toBe(false)
  })
})
