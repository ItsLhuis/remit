import { describe, expect, test } from "vitest"

import { generateCreditNoteNumber } from "../creditNoteNumber"

describe("generateCreditNoteNumber", () => {
  test("pads the counter to the configured width", () => {
    expect(generateCreditNoteNumber({ prefix: "CN-", nextSequence: 42, paddingWidth: 4 })).toBe(
      "CN-0042"
    )
  })

  test("keeps every digit when the counter is wider than the padding", () => {
    expect(generateCreditNoteNumber({ prefix: "CN-", nextSequence: 100000, paddingWidth: 4 })).toBe(
      "CN-100000"
    )
  })

  test("emits the bare counter when the padding width is zero", () => {
    expect(generateCreditNoteNumber({ prefix: "C", nextSequence: 7, paddingWidth: 0 })).toBe("C7")
  })

  test("produces a strictly increasing sequence for consecutive counters", () => {
    const numbers = [1, 2, 3].map((nextSequence) =>
      generateCreditNoteNumber({ prefix: "CN-", nextSequence, paddingWidth: 3 })
    )

    expect(numbers).toEqual(["CN-001", "CN-002", "CN-003"])
  })

  test("produces distinct numbers for every counter in a run", () => {
    const numbers = Array.from({ length: 250 }, (_, index) =>
      generateCreditNoteNumber({ prefix: "CN-", nextSequence: index + 1, paddingWidth: 4 })
    )

    expect(new Set(numbers).size).toBe(numbers.length)
  })

  test("honours a prefix the instance has customised", () => {
    expect(generateCreditNoteNumber({ prefix: "2026/CN-", nextSequence: 9, paddingWidth: 5 })).toBe(
      "2026/CN-00009"
    )
  })

  test("does not collide with an invoice number drawn from the same counter", () => {
    const creditNote = generateCreditNoteNumber({
      prefix: "CN-",
      nextSequence: 1,
      paddingWidth: 4
    })

    expect(creditNote).not.toBe("INV-0001")
  })
})
