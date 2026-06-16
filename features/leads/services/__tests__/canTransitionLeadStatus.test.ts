import { describe, expect, test } from "vitest"

import { LEAD_STATUS_VALUES, type LeadStatus } from "../../schemas"
import {
  canTransitionLeadStatus,
  getNextLeadStatuses,
  isTerminalLeadStatus
} from "../canTransitionLeadStatus"

const ALLOWED_PAIRS: ReadonlyArray<[LeadStatus, LeadStatus]> = [
  ["new", "contacted"],
  ["contacted", "new"],
  ["contacted", "qualified"],
  ["qualified", "contacted"],
  ["qualified", "proposal_sent"],
  ["proposal_sent", "qualified"],
  ["proposal_sent", "won"],
  ["proposal_sent", "lost"]
]

function isAllowedPair(current: LeadStatus, next: LeadStatus): boolean {
  return ALLOWED_PAIRS.some(([from, to]) => from === current && to === next)
}

describe("canTransitionLeadStatus", () => {
  test.each(ALLOWED_PAIRS)("allows %s to %s", (current, next) => {
    const result = canTransitionLeadStatus(current, next)

    expect(result).toEqual({ allowed: true, nextStatus: next })
  })

  test("rejects every transition outside the allowed set across all pairs", () => {
    const rejected = LEAD_STATUS_VALUES.flatMap((current) =>
      LEAD_STATUS_VALUES.filter((next) => !isAllowedPair(current, next)).map((next) =>
        canTransitionLeadStatus(current, next)
      )
    )

    expect(rejected.every((result) => result.allowed === false)).toBe(true)
  })

  test("reports same_status when the target equals the current status", () => {
    const result = canTransitionLeadStatus("new", "new")

    expect(result).toEqual({ allowed: false, reason: "same_status" })
  })

  test("reports terminal when transitioning out of a won lead", () => {
    const result = canTransitionLeadStatus("won", "contacted")

    expect(result).toEqual({ allowed: false, reason: "terminal" })
  })

  test("reports terminal when transitioning out of a lost lead", () => {
    const result = canTransitionLeadStatus("lost", "new")

    expect(result).toEqual({ allowed: false, reason: "terminal" })
  })

  test("reports not_allowed when skipping pipeline stages", () => {
    const result = canTransitionLeadStatus("new", "won")

    expect(result).toEqual({ allowed: false, reason: "not_allowed" })
  })
})

describe("getNextLeadStatuses", () => {
  test("returns the forward and backward neighbours for an active stage", () => {
    expect(getNextLeadStatuses("qualified")).toEqual(["contacted", "proposal_sent"])
  })

  test("returns no transitions for terminal stages", () => {
    expect(getNextLeadStatuses("won")).toEqual([])
    expect(getNextLeadStatuses("lost")).toEqual([])
  })
})

describe("isTerminalLeadStatus", () => {
  test("treats won and lost as terminal and active stages as non-terminal", () => {
    expect(isTerminalLeadStatus("won")).toBe(true)
    expect(isTerminalLeadStatus("lost")).toBe(true)
    expect(isTerminalLeadStatus("new")).toBe(false)
    expect(isTerminalLeadStatus("proposal_sent")).toBe(false)
  })
})
