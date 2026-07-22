import { describe, expect, test } from "vitest"

import { intersectPropertyGroups, sharedValue } from "../sharedValue"

describe("sharedValue", () => {
  test("returns the uniform value when every member agrees", () => {
    expect(sharedValue([8, 8, 8])).toEqual({ kind: "uniform", value: 8 })
  })

  test("returns mixed when any member differs", () => {
    expect(sharedValue([8, 8, 16])).toEqual({ kind: "mixed" })
  })

  test("treats a shared null as uniform, distinct from mixed", () => {
    expect(sharedValue([null, null])).toEqual({ kind: "uniform", value: null })
    expect(sharedValue([null, 8])).toEqual({ kind: "mixed" })
  })

  test("returns the single member's value for a one-element list", () => {
    expect(sharedValue(["left"])).toEqual({ kind: "uniform", value: "left" })
  })

  test("returns mixed for an empty list", () => {
    expect(sharedValue([])).toEqual({ kind: "mixed" })
  })
})

describe("intersectPropertyGroups", () => {
  test("returns the groups every selected type shares", () => {
    expect(intersectPropertyGroups(["text", "image"])).toEqual(["spacing", "appearance"])
  })

  test("keeps a single type's full group list", () => {
    expect(intersectPropertyGroups(["text"])).toEqual(["spacing", "appearance", "typography"])
  })

  test("returns no groups for an empty type list", () => {
    expect(intersectPropertyGroups([])).toEqual([])
  })
})
