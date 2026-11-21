import { describe, expect, test } from "vitest"

import { assertValidJobId } from "../jobId"

describe("assertValidJobId", () => {
  test("throws when the id contains a colon", () => {
    expect(() => assertValidJobId("invoice.reminder.send.abc.after.7:1")).toThrow(/cannot contain/)
  })

  // BullMQ still accepts a three-part colon id through a back-compat branch its own source marks for
  // removal. The rejection here is deliberate and stricter than upstream, so this test is the one
  // that fails if someone "fixes" the validator to mirror BullMQ exactly.
  test("throws when the id has exactly three colon-delimited parts", () => {
    expect(() => assertValidJobId("recurring.invoice.generate:abc:2026-08-13")).toThrow(
      /cannot contain/
    )
  })

  test("throws when the id is an integer", () => {
    expect(() => assertValidJobId("42")).toThrow(/cannot be an integer/)
  })

  test("throws when the id is empty", () => {
    expect(() => assertValidJobId("")).toThrow(/cannot be empty/)
  })

  test("accepts a dot-separated entity-scoped id", () => {
    expect(() =>
      assertValidJobId("invoice.reminder.send.11111111-1111-1111-1111-111111111111.after.7")
    ).not.toThrow()
  })

  test("accepts an id whose leading segment is numeric but which is not an integer", () => {
    expect(() => assertValidJobId("42.invoice.pdf.render")).not.toThrow()
  })
})
