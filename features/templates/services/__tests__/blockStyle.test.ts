import { describe, expect, test } from "vitest"

import { patchBlockStyle } from "../blockStyle"

describe("patchBlockStyle", () => {
  test("adds a property to an existing style without touching the rest", () => {
    expect(patchBlockStyle({ fontSize: 14 }, { textColor: "#123456" })).toEqual({
      fontSize: 14,
      textColor: "#123456"
    })
  })

  test("creates a style object from undefined", () => {
    expect(patchBlockStyle(undefined, { borderWidth: 2 })).toEqual({ borderWidth: 2 })
  })

  test("removes a property when the patch value is undefined", () => {
    expect(
      patchBlockStyle({ fontSize: 14, textColor: "#123456" }, { textColor: undefined })
    ).toEqual({ fontSize: 14 })
  })

  test("collapses to undefined when the last property is removed", () => {
    expect(patchBlockStyle({ fontSize: 14 }, { fontSize: undefined })).toBeUndefined()
  })
})
