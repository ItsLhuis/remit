import { describe, expect, test } from "vitest"

import { makeFrameBlock, makeShapeBlock, makeTextBlock } from "@/tests/factories/blocks"

import { buildIndex } from "../blockIndex"
import { cursorForHandle, handlePositions, moveGuides, selectionBounds } from "../selectionGeometry"

const margins = { top: 32, left: 32 }

describe("selectionBounds", () => {
  test("returns the page-space rect of a single selected block", () => {
    const index = buildIndex([
      makeFrameBlock({
        id: "frame",
        layout: { x: 80, y: 80 },
        children: [makeTextBlock({ id: "child", layout: { x: 16, y: 24, width: 96, height: 32 } })]
      })
    ])

    expect(selectionBounds(index, ["child"])).toEqual({ x: 96, y: 104, width: 96, height: 32 })
  })

  test("returns the union rect of a multi-selection and null for an empty one", () => {
    const index = buildIndex([
      makeShapeBlock({ id: "a", layout: { x: 0, y: 0, width: 40, height: 40 } }),
      makeShapeBlock({ id: "b", layout: { x: 100, y: 60, width: 40, height: 40 } })
    ])

    expect(selectionBounds(index, ["a", "b"])).toEqual({ x: 0, y: 0, width: 140, height: 100 })
    expect(selectionBounds(index, [])).toBeNull()
  })

  test("a rotated member contributes its rotated footprint so the bounds enclose what is painted", () => {
    const index = buildIndex([
      makeShapeBlock({
        id: "rotated",
        layout: { x: 40, y: 40, width: 160, height: 80 },
        rotation: 90
      })
    ])

    const bounds = selectionBounds(index, ["rotated"])

    expect(bounds?.x).toBeCloseTo(80)
    expect(bounds?.y).toBeCloseTo(0)
    expect(bounds?.width).toBeCloseTo(80)
    expect(bounds?.height).toBeCloseTo(160)
  })
})

describe("moveGuides", () => {
  test("shows a neighbour's facing edge when the moving rect approaches within the threshold", () => {
    const index = buildIndex([
      makeShapeBlock({ id: "moving", layout: { x: 0, y: 0, width: 160, height: 96 } }),
      makeShapeBlock({ id: "neighbour", layout: { x: 200, y: 0, width: 160, height: 96 } })
    ])

    const guides = moveGuides({
      moving: { x: 24, y: 0, width: 160, height: 96 },
      movingIds: new Set(["moving"]),
      index,
      margins
    })

    expect(guides).toEqual([
      {
        key: "neighbour-left",
        orientation: "vertical",
        at: margins.left + 200,
        emphasis: "near"
      }
    ])
  })

  test("marks a guide as reached when the edges meet exactly", () => {
    const index = buildIndex([
      makeShapeBlock({ id: "moving", layout: { x: 0, y: 0, width: 160, height: 96 } }),
      makeShapeBlock({ id: "neighbour", layout: { x: 200, y: 0, width: 160, height: 96 } })
    ])

    const guides = moveGuides({
      moving: { x: 40, y: 0, width: 160, height: 96 },
      movingIds: new Set(["moving"]),
      index,
      margins
    })

    expect(guides).toEqual([
      {
        key: "neighbour-left",
        orientation: "vertical",
        at: margins.left + 200,
        emphasis: "reached"
      }
    ])
  })

  test("ignores edges without cross-axis overlap and neighbours in the moving set", () => {
    const index = buildIndex([
      makeShapeBlock({ id: "moving", layout: { x: 0, y: 0, width: 160, height: 96 } }),
      makeShapeBlock({ id: "faraway", layout: { x: 200, y: 400, width: 160, height: 96 } }),
      makeShapeBlock({ id: "carried", layout: { x: 200, y: 0, width: 160, height: 96 } })
    ])

    const guides = moveGuides({
      moving: { x: 24, y: 0, width: 160, height: 96 },
      movingIds: new Set(["moving", "carried"]),
      index,
      margins
    })

    expect(guides).toEqual([])
  })

  test("only top-level blocks contribute guides", () => {
    const child = makeTextBlock({ id: "child", layout: { x: 0, y: 0, width: 96, height: 96 } })
    const index = buildIndex([
      makeShapeBlock({ id: "moving", layout: { x: 0, y: 0, width: 160, height: 96 } }),
      makeFrameBlock({
        id: "frame",
        layout: { x: 200, y: 0, width: 480, height: 240 },
        children: [child]
      })
    ])

    const guides = moveGuides({
      moving: { x: 24, y: 0, width: 160, height: 96 },
      movingIds: new Set(["moving"]),
      index,
      margins
    })

    expect(guides.map((guide) => guide.key)).toEqual(["frame-left"])
  })
})

describe("handlePositions", () => {
  const rect = { x: 100, y: 200, width: 160, height: 80 }

  test("places each handle at its corner or edge midpoint at rotation 0", () => {
    expect(handlePositions(rect, 0)).toEqual({
      nw: { x: 100, y: 200 },
      n: { x: 180, y: 200 },
      ne: { x: 260, y: 200 },
      e: { x: 260, y: 240 },
      se: { x: 260, y: 280 },
      s: { x: 180, y: 280 },
      sw: { x: 100, y: 280 },
      w: { x: 100, y: 240 }
    })
  })

  test("rotates handle positions about the rect's center", () => {
    const square = { x: 100, y: 200, width: 80, height: 80 }

    const positions = handlePositions(square, 90)

    // A 90° rotation of a square rect swaps the north handle onto the east edge's midpoint.
    expect(positions.n.x).toBeCloseTo(180)
    expect(positions.n.y).toBeCloseTo(240)
  })
})

describe("cursorForHandle", () => {
  test("returns the straight or diagonal cursor for each direction at rotation 0", () => {
    expect(cursorForHandle("n", 0)).toBe("ns-resize")
    expect(cursorForHandle("s", 0)).toBe("ns-resize")
    expect(cursorForHandle("e", 0)).toBe("ew-resize")
    expect(cursorForHandle("w", 0)).toBe("ew-resize")
    expect(cursorForHandle("ne", 0)).toBe("nesw-resize")
    expect(cursorForHandle("sw", 0)).toBe("nesw-resize")
    expect(cursorForHandle("nw", 0)).toBe("nwse-resize")
    expect(cursorForHandle("se", 0)).toBe("nwse-resize")
  })

  test("rotates the cursor by 45° buckets so a rotated block's edge reads as a diagonal", () => {
    expect(cursorForHandle("n", 45)).toBe("nesw-resize")
    expect(cursorForHandle("n", 90)).toBe("ew-resize")
  })

  test("normalizes rotations outside [0, 360) before bucketing", () => {
    expect(cursorForHandle("n", -45)).toBe(cursorForHandle("n", 315))
    expect(cursorForHandle("e", 450)).toBe(cursorForHandle("e", 90))
  })
})
