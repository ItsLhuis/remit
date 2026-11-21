import { describe, expect, test } from "vitest"

import { getSortingStateParser } from "../dataTable"

describe("getSortingStateParser", () => {
  test("parses a valid sorting state from a JSON string", () => {
    const parser = getSortingStateParser()

    const result = parser.parse('[{"id":"name","desc":true}]')

    expect(result).toEqual([{ id: "name", desc: true }])
  })

  test("returns null when the value is not valid JSON", () => {
    const parser = getSortingStateParser()

    const result = parser.parse("not-json")

    expect(result).toBeNull()
  })

  test("returns null when the shape does not match the sorting schema", () => {
    const parser = getSortingStateParser()

    const result = parser.parse('[{"id":"name"}]')

    expect(result).toBeNull()
  })

  test("returns null when a sort id is not in the allowed column set", () => {
    const parser = getSortingStateParser(new Set(["name", "currency"]))

    const result = parser.parse('[{"id":"secret","desc":false}]')

    expect(result).toBeNull()
  })

  test("serializes sorting state back to a JSON string", () => {
    const parser = getSortingStateParser()

    const result = parser.serialize([{ id: "currency", desc: false }])

    expect(result).toBe('[{"id":"currency","desc":false}]')
  })
})
