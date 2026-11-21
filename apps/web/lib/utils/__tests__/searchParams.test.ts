import { describe, expect, test } from "vitest"

import {
  readArrayParam,
  readDateAt,
  readIntParam,
  readNumberAt,
  readSortParam,
  readStringParam
} from "../searchParams"

describe("readStringParam", () => {
  test("returns the value when the parameter is a string", () => {
    const result = readStringParam({ search: "acme" }, "search")

    expect(result).toBe("acme")
  })

  test("returns the first entry when the parameter repeats", () => {
    const result = readStringParam({ status: ["deleted", "all"] }, "status")

    expect(result).toBe("deleted")
  })

  test("reads from URLSearchParams when given one", () => {
    const result = readStringParam(new URLSearchParams("search=acme"), "search")

    expect(result).toBe("acme")
  })

  test("returns an empty string when the parameter is missing or the input is not an object", () => {
    expect(readStringParam({}, "search")).toBe("")
    expect(readStringParam(null, "search")).toBe("")
    expect(readStringParam("search=acme", "search")).toBe("")
  })
})

describe("readArrayParam", () => {
  test("splits a comma separated value and trims each entry", () => {
    const result = readArrayParam({ currency: "eur, usd ,gbp" }, "currency")

    expect(result).toEqual(["eur", "usd", "gbp"])
  })

  test("drops empty entries and returns an empty array when the parameter is absent", () => {
    expect(readArrayParam({ currency: "eur,,usd" }, "currency")).toEqual(["eur", "usd"])
    expect(readArrayParam({}, "currency")).toEqual([])
  })
})

describe("readIntParam", () => {
  test("returns the parsed positive integer", () => {
    const result = readIntParam({ page: "3" }, "page", 1)

    expect(result).toBe(3)
  })

  test("falls back when the value is missing, zero, negative, or not a number", () => {
    expect(readIntParam({}, "page", 1)).toBe(1)
    expect(readIntParam({ page: "0" }, "page", 1)).toBe(1)
    expect(readIntParam({ page: "-2" }, "page", 1)).toBe(1)
    expect(readIntParam({ page: "many" }, "page", 1)).toBe(1)
  })
})

describe("readNumberAt", () => {
  test("returns the parsed number at the index", () => {
    const result = readNumberAt(["100", "500"], 1)

    expect(result).toBe(500)
  })

  test("returns null when the entry is absent, empty, or not a number", () => {
    expect(readNumberAt([], 0)).toBeNull()
    expect(readNumberAt([""], 0)).toBeNull()
    expect(readNumberAt(["none"], 0)).toBeNull()
  })
})

describe("readDateAt", () => {
  test("builds a date from an epoch milliseconds entry", () => {
    const result = readDateAt(["1700000000000"], 0)

    expect(result).toEqual(new Date(1700000000000))
  })

  test("returns null when the entry is absent, empty, or not a number", () => {
    expect(readDateAt([], 0)).toBeNull()
    expect(readDateAt([""], 0)).toBeNull()
    expect(readDateAt(["yesterday"], 0)).toBeNull()
  })
})

describe("readSortParam", () => {
  test("parses the sort parameter as JSON", () => {
    const result = readSortParam({ sort: '[{"id":"name","desc":true}]' }, [])

    expect(result).toEqual([{ id: "name", desc: true }])
  })

  test("returns the fallback when the parameter is missing or malformed", () => {
    const fallback = [{ id: "type", desc: false }]

    expect(readSortParam({}, fallback)).toBe(fallback)
    expect(readSortParam({ sort: "{oops" }, fallback)).toBe(fallback)
  })
})
