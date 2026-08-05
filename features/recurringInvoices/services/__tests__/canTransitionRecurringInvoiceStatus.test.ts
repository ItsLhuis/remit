import { describe, expect, test } from "vitest"

import { canTransitionRecurringInvoiceStatus } from "../canTransitionRecurringInvoiceStatus"

describe("allowed transitions", () => {
  test.each([
    ["active", "paused"],
    ["active", "cancelled"],
    ["active", "completed"],
    ["paused", "active"],
    ["paused", "cancelled"]
  ] as const)("allows %s to %s", (from, to) => {
    expect(canTransitionRecurringInvoiceStatus(from, to)).toEqual({
      allowed: true,
      nextStatus: to
    })
  })
})

describe("terminal statuses", () => {
  test.each(["completed", "cancelled"] as const)("refuses to leave %s", (from) => {
    expect(canTransitionRecurringInvoiceStatus(from, "active")).toEqual({
      allowed: false,
      reason: "terminal"
    })
  })
})

describe("refusals", () => {
  test("refuses a transition to the same status", () => {
    expect(canTransitionRecurringInvoiceStatus("active", "active")).toEqual({
      allowed: false,
      reason: "same_status"
    })
  })

  // A paused schedule has no run in flight, so there is no end condition to have been met; only the
  // generation job completes a schedule, and it only ever sees active ones.
  test("refuses completing a paused schedule", () => {
    expect(canTransitionRecurringInvoiceStatus("paused", "completed")).toEqual({
      allowed: false,
      reason: "not_allowed"
    })
  })
})
