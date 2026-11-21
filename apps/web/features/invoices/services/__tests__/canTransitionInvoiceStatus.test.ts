import { describe, expect, test } from "vitest"

import {
  canTransitionInvoiceStatus,
  getNextInvoiceStatuses,
  isInvoiceEditable
} from "../canTransitionInvoiceStatus"

describe("canTransitionInvoiceStatus", () => {
  test("allows a draft to be issued", () => {
    expect(canTransitionInvoiceStatus("draft", "sent")).toEqual({
      allowed: true,
      nextStatus: "sent"
    })
  })

  test("allows an issued invoice to settle", () => {
    expect(canTransitionInvoiceStatus("sent", "paid")).toEqual({
      allowed: true,
      nextStatus: "paid"
    })
  })

  test("refuses to settle an invoice the client has never received", () => {
    expect(canTransitionInvoiceStatus("draft", "paid")).toEqual({
      allowed: false,
      reason: "not_allowed"
    })
  })

  test("refuses to reopen an issued invoice as a draft", () => {
    expect(canTransitionInvoiceStatus("sent", "draft")).toEqual({
      allowed: false,
      reason: "not_allowed"
    })
  })

  test("treats a paid invoice as terminal", () => {
    expect(canTransitionInvoiceStatus("paid", "sent")).toEqual({
      allowed: false,
      reason: "not_allowed"
    })
  })

  test("reports a no-op transition separately from a forbidden one", () => {
    expect(canTransitionInvoiceStatus("sent", "sent")).toEqual({
      allowed: false,
      reason: "same_status"
    })
  })
})

describe("getNextInvoiceStatuses", () => {
  test("offers only the forward status from each stored state", () => {
    expect(getNextInvoiceStatuses("draft")).toEqual(["sent"])
    expect(getNextInvoiceStatuses("sent")).toEqual(["paid"])
    expect(getNextInvoiceStatuses("paid")).toEqual([])
  })
})

describe("isInvoiceEditable", () => {
  test("permits edits only while the invoice is a draft", () => {
    expect(isInvoiceEditable("draft")).toBe(true)
    expect(isInvoiceEditable("sent")).toBe(false)
    expect(isInvoiceEditable("paid")).toBe(false)
  })
})
