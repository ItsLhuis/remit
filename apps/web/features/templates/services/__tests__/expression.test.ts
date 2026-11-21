import { describe, expect, test } from "vitest"

import { evaluateFieldExpression } from "../expression"

describe("evaluateFieldExpression", () => {
  test("adds a leading-plus expression to the current value", () => {
    expect(evaluateFieldExpression("+10", 100)).toBe(110)
  })

  test("evaluates a standalone division expression regardless of the current value", () => {
    expect(evaluateFieldExpression("240/2", 999)).toBe(120)
  })

  test("evaluates multiplication before subtraction in a standalone expression", () => {
    expect(evaluateFieldExpression("10*3-8", 0)).toBe(22)
  })

  test("subtracts a leading-minus expression from the current value", () => {
    expect(evaluateFieldExpression("-15", 100)).toBe(85)
  })

  test("applies operator precedence to a relative expression", () => {
    expect(evaluateFieldExpression("+10*2", 100)).toBe(120)
  })

  test("parses a plain integer with no operators", () => {
    expect(evaluateFieldExpression("42", 0)).toBe(42)
  })

  test("parses a decimal value", () => {
    expect(evaluateFieldExpression("12.5", 0)).toBe(12.5)
  })

  test("tolerates surrounding whitespace", () => {
    expect(evaluateFieldExpression("  240 / 2  ", 0)).toBe(120)
  })

  test("reverts on unparseable garbage", () => {
    expect(evaluateFieldExpression("abc", 100)).toBeNull()
  })

  test("reverts on an empty string", () => {
    expect(evaluateFieldExpression("", 100)).toBeNull()
  })

  test("reverts on a dangling trailing operator", () => {
    expect(evaluateFieldExpression("10+", 100)).toBeNull()
  })

  test("reverts on two consecutive binary operators", () => {
    expect(evaluateFieldExpression("10*/2", 100)).toBeNull()
  })

  test("reverts on division by zero", () => {
    expect(evaluateFieldExpression("10/0", 100)).toBeNull()
  })

  test("reverts a relative expression when there is no current value", () => {
    expect(evaluateFieldExpression("+10", null)).toBeNull()
  })

  test("reverts trailing garbage after a valid expression", () => {
    expect(evaluateFieldExpression("10+5x", 0)).toBeNull()
  })
})
