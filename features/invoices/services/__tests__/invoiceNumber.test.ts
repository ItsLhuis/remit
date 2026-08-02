import { describe, expect, test } from "vitest"

import { generateInvoiceNumber } from "../invoiceNumber"

describe("generateInvoiceNumber", () => {
  test("pads the counter to the configured width", () => {
    expect(generateInvoiceNumber({ prefix: "INV-", nextSequence: 42, paddingWidth: 4 })).toBe(
      "INV-0042"
    )
  })

  test("keeps every digit when the counter is wider than the padding", () => {
    expect(generateInvoiceNumber({ prefix: "INV-", nextSequence: 100000, paddingWidth: 4 })).toBe(
      "INV-100000"
    )
  })

  test("emits the bare counter when the padding width is zero", () => {
    expect(generateInvoiceNumber({ prefix: "F", nextSequence: 7, paddingWidth: 0 })).toBe("F7")
  })

  test("produces a strictly increasing sequence for consecutive counters", () => {
    const numbers = [1, 2, 3].map((nextSequence) =>
      generateInvoiceNumber({ prefix: "INV-", nextSequence, paddingWidth: 3 })
    )

    expect(numbers).toEqual(["INV-001", "INV-002", "INV-003"])
  })

  test("honours a prefix the instance has customised", () => {
    expect(generateInvoiceNumber({ prefix: "2026/", nextSequence: 9, paddingWidth: 5 })).toBe(
      "2026/00009"
    )
  })
})
