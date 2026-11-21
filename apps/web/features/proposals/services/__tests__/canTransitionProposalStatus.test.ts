import { describe, expect, test } from "vitest"

import { type ProposalStatus } from "../../schemas"
import {
  canTransitionProposalStatus,
  getNextProposalStatuses,
  isProposalEditable
} from "../canTransitionProposalStatus"

const allowed: ReadonlyArray<[ProposalStatus, ProposalStatus]> = [
  ["draft", "sent"],
  ["sent", "accepted"],
  ["sent", "rejected"]
]

const rejected: ReadonlyArray<[ProposalStatus, ProposalStatus]> = [
  ["draft", "accepted"],
  ["draft", "rejected"],
  ["sent", "draft"],
  ["accepted", "draft"],
  ["accepted", "sent"],
  ["accepted", "rejected"],
  ["rejected", "draft"],
  ["rejected", "sent"],
  ["rejected", "accepted"]
]

describe("canTransitionProposalStatus", () => {
  test.each(allowed)("allows %s to %s", (current, next) => {
    expect(canTransitionProposalStatus(current, next)).toEqual({ allowed: true, nextStatus: next })
  })

  test.each(rejected)("rejects %s to %s", (current, next) => {
    expect(canTransitionProposalStatus(current, next)).toEqual({
      allowed: false,
      reason: "not_allowed"
    })
  })

  test("rejects a no-op transition as same_status", () => {
    expect(canTransitionProposalStatus("sent", "sent")).toEqual({
      allowed: false,
      reason: "same_status"
    })
  })
})

describe("getNextProposalStatuses", () => {
  test("offers only sent from a draft", () => {
    expect(getNextProposalStatuses("draft")).toEqual(["sent"])
  })

  test("offers no onward status from a terminal one", () => {
    expect(getNextProposalStatuses("accepted")).toEqual([])
    expect(getNextProposalStatuses("rejected")).toEqual([])
  })
})

describe("isProposalEditable", () => {
  test("treats only a draft as editable", () => {
    expect(isProposalEditable("draft")).toBe(true)
    expect(isProposalEditable("sent")).toBe(false)
    expect(isProposalEditable("accepted")).toBe(false)
    expect(isProposalEditable("rejected")).toBe(false)
  })
})
