import { describe, expect, test } from "vitest"

import { type RecurringInvoiceLineItemValues } from "../../schemas"
import { toBlueprintLines } from "../buildBlueprint"

const TAX_RATE_ID = "6f1c1b8e-6b1e-4a5f-9f2e-2f1a0d3c4b5a"

const makeLine = (
  overrides: Partial<RecurringInvoiceLineItemValues> = {}
): RecurringInvoiceLineItemValues => ({
  description: "Retainer",
  unit: "",
  quantity: 1,
  unitPrice: 150_000,
  taxRateId: null,
  discountKind: "none",
  discountPercentage: null,
  discountAmount: null,
  ...overrides
})

describe("field mapping", () => {
  test("carries the description, quantity and unit price across", () => {
    const [line] = toBlueprintLines([makeLine()], new Map())

    expect(line).toMatchObject({ description: "Retainer", quantity: 1, unitPriceCents: 150_000 })
  })

  test("stores an empty unit as null", () => {
    const [line] = toBlueprintLines([makeLine({ unit: "" })], new Map())

    expect(line?.unit).toBeNull()
  })

  test("keeps a populated unit", () => {
    const [line] = toBlueprintLines([makeLine({ unit: "hours" })], new Map())

    expect(line?.unit).toBe("hours")
  })

  test("maps every line in order", () => {
    const lines = toBlueprintLines(
      [makeLine({ description: "First" }), makeLine({ description: "Second" })],
      new Map()
    )

    expect(lines.map((line) => line.description)).toEqual(["First", "Second"])
  })
})

describe("tax snapshot", () => {
  test("freezes the percentage of the referenced rate", () => {
    const [line] = toBlueprintLines(
      [makeLine({ taxRateId: TAX_RATE_ID })],
      new Map([[TAX_RATE_ID, 23]])
    )

    expect(line).toMatchObject({ taxRateId: TAX_RATE_ID, taxPercentage: 23 })
  })

  test("treats a line with no tax rate as zero percent", () => {
    const [line] = toBlueprintLines([makeLine({ taxRateId: null })], new Map([[TAX_RATE_ID, 23]]))

    expect(line?.taxPercentage).toBe(0)
  })

  test("falls back to zero percent when the rate is missing from the lookup", () => {
    const [line] = toBlueprintLines([makeLine({ taxRateId: TAX_RATE_ID })], new Map())

    expect(line?.taxPercentage).toBe(0)
  })
})

describe("discount shape", () => {
  test("populates only the percentage columns for a percentage discount", () => {
    const [line] = toBlueprintLines(
      [makeLine({ discountKind: "percentage", discountPercentage: 10 })],
      new Map()
    )

    expect(line).toMatchObject({
      discountType: "percentage",
      discountPercentage: 10,
      discountAmountCents: null
    })
  })

  test("populates only the amount columns for a fixed discount", () => {
    const [line] = toBlueprintLines(
      [makeLine({ discountKind: "fixed", discountAmount: 2500 })],
      new Map()
    )

    expect(line).toMatchObject({
      discountType: "fixed",
      discountPercentage: null,
      discountAmountCents: 2500
    })
  })

  test("leaves all three discount columns null when there is no discount", () => {
    const [line] = toBlueprintLines([makeLine()], new Map())

    expect(line).toMatchObject({
      discountType: null,
      discountPercentage: null,
      discountAmountCents: null
    })
  })

  // The schema refinement should stop this reaching here, but the mapper is the last thing before a
  // write that `chk_line_items_discount_shape` will eventually judge, so a kind without its value
  // degrades to no discount rather than to a half-populated row.
  test.each([
    { discountKind: "percentage", discountPercentage: null },
    { discountKind: "fixed", discountAmount: null }
  ] as const)("stores no discount for the incomplete pair %j", (overrides) => {
    const [line] = toBlueprintLines([makeLine(overrides)], new Map())

    expect(line?.discountType).toBeNull()
  })
})
