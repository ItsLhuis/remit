import { describe, expect, test } from "vitest"

import { formatCentsForInput, isValidAmount, parseAmountToCents } from "../money"

describe("parseAmountToCents", () => {
  test("converts a whole-number amount to cents", () => {
    const result = parseAmountToCents("1500")

    expect(result).toBe(150000)
  })

  test("converts a two-decimal amount without floating-point drift", () => {
    const result = parseAmountToCents("1500.55")

    expect(result).toBe(150055)
  })

  test("pads a single-decimal amount to two fractional digits", () => {
    const result = parseAmountToCents("1500.5")

    expect(result).toBe(150050)
  })

  test("preserves a leading-zero fractional amount", () => {
    const result = parseAmountToCents("0.05")

    expect(result).toBe(5)
  })

  test("returns null for an empty string", () => {
    const result = parseAmountToCents("  ")

    expect(result).toBeNull()
  })

  test("returns null when the value is not a plain non-negative amount", () => {
    expect(parseAmountToCents("-5")).toBeNull()
    expect(parseAmountToCents("1,500")).toBeNull()
    expect(parseAmountToCents("1500.555")).toBeNull()
    expect(parseAmountToCents("abc")).toBeNull()
  })
})

describe("isValidAmount", () => {
  test("treats an empty value as valid because amounts are optional", () => {
    expect(isValidAmount("")).toBe(true)
  })

  test("rejects values that are not non-negative decimals", () => {
    expect(isValidAmount("1500.55")).toBe(true)
    expect(isValidAmount("-1")).toBe(false)
    expect(isValidAmount("1.234")).toBe(false)
  })
})

describe("formatCentsForInput", () => {
  test("formats cents as a two-decimal major-unit string", () => {
    expect(formatCentsForInput(150000)).toBe("1500.00")
    expect(formatCentsForInput(5)).toBe("0.05")
  })

  test("returns an empty string when there is no value", () => {
    expect(formatCentsForInput(null)).toBe("")
  })
})
