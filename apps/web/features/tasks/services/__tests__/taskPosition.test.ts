import { describe, expect, test } from "vitest"

import {
  getInitialTaskPosition,
  getPositionBetween,
  planTaskReorder,
  repackPositions
} from "../taskPosition"

describe("getInitialTaskPosition", () => {
  test("returns STEP for an empty column", () => {
    expect(getInitialTaskPosition([])).toBe(1000)
  })

  test("returns max + STEP otherwise", () => {
    expect(getInitialTaskPosition([1000, 3000, 2000])).toBe(4000)
  })
})

describe("getPositionBetween", () => {
  test("returns the integer midpoint", () => {
    expect(getPositionBetween(1000, 2000)).toBe(1500)
  })

  test("returns null when no integer gap exists", () => {
    expect(getPositionBetween(1000, 1001)).toBeNull()
  })

  test("steps below the head and above the tail", () => {
    expect(getPositionBetween(null, 1000)).toBe(0)
    expect(getPositionBetween(2000, null)).toBe(3000)
  })

  test("returns STEP for an empty column", () => {
    expect(getPositionBetween(null, null)).toBe(1000)
  })
})

describe("repackPositions", () => {
  test("evenly spaces positions", () => {
    expect(repackPositions(3)).toEqual([1000, 2000, 3000])
  })
})

describe("planTaskReorder", () => {
  test("returns a single update when a gap exists", () => {
    const ordered = [
      { id: "a", position: 1000 },
      { id: "b", position: 2000 },
      { id: "c", position: 3000 }
    ]

    expect(planTaskReorder(ordered, "c", 1)).toEqual([{ id: "c", position: 1500 }])
  })

  test("repacks the whole column when neighbors are adjacent", () => {
    const ordered = [
      { id: "a", position: 1 },
      { id: "b", position: 2 },
      { id: "c", position: 3 }
    ]

    expect(planTaskReorder(ordered, "c", 1)).toEqual([
      { id: "a", position: 1000 },
      { id: "c", position: 2000 },
      { id: "b", position: 3000 }
    ])
  })

  test("returns no updates when the moved id is absent", () => {
    expect(planTaskReorder([{ id: "a", position: 1000 }], "missing", 0)).toEqual([])
  })
})
