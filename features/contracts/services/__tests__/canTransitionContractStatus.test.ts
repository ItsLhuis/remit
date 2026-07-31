import { expect, test } from "vitest"

import {
  canTransitionContractStatus,
  getNextContractStatuses,
  isContractEditable
} from "../canTransitionContractStatus"

test("allows sending a draft contract", () => {
  const result = canTransitionContractStatus("draft", "sent")

  expect(result).toEqual({ allowed: true, nextStatus: "sent" })
})

test("allows a sent contract to be signed, to expire, or to be terminated", () => {
  expect(canTransitionContractStatus("sent", "signed").allowed).toBe(true)
  expect(canTransitionContractStatus("sent", "expired").allowed).toBe(true)
  expect(canTransitionContractStatus("sent", "terminated").allowed).toBe(true)
})

test("allows terminating a signed contract", () => {
  expect(canTransitionContractStatus("signed", "terminated")).toEqual({
    allowed: true,
    nextStatus: "terminated"
  })
})

test("rejects reopening a sent contract as a draft", () => {
  expect(canTransitionContractStatus("sent", "draft")).toEqual({
    allowed: false,
    reason: "not_allowed"
  })
})

test("rejects sending a contract that is already signed, expired, or terminated", () => {
  expect(canTransitionContractStatus("signed", "sent").allowed).toBe(false)
  expect(canTransitionContractStatus("expired", "sent").allowed).toBe(false)
  expect(canTransitionContractStatus("terminated", "sent").allowed).toBe(false)
})

test("rejects a transition to the same status", () => {
  expect(canTransitionContractStatus("sent", "sent")).toEqual({
    allowed: false,
    reason: "same_status"
  })
})

test("reports no onward statuses for a terminated contract", () => {
  expect(getNextContractStatuses("terminated")).toEqual([])
})

test("treats only a draft contract as editable", () => {
  expect(isContractEditable("draft")).toBe(true)
  expect(isContractEditable("sent")).toBe(false)
  expect(isContractEditable("signed")).toBe(false)
  expect(isContractEditable("expired")).toBe(false)
  expect(isContractEditable("terminated")).toBe(false)
})
