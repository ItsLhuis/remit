import { describe, expect, test } from "vitest"

import {
  clampRectPositionToBounds,
  clampRotatedRectPositionToBounds,
  fitRotatedRectWithinBounds,
  floorRotatedRectAtOrigin,
  normalizeDegrees,
  pointInRect,
  pointInRotatedRect,
  rectsIntersect,
  rectsIntersectRotated,
  rotatedAabb,
  rotatePoint,
  shiftSpanIntoRange,
  translateRect,
  unionRects
} from "../geometry"

describe("pointInRect", () => {
  test("contains interior points and includes the rectangle edges", () => {
    const rect = { x: 10, y: 20, width: 100, height: 50 }

    expect(pointInRect({ x: 50, y: 40 }, rect)).toBe(true)
    expect(pointInRect({ x: 10, y: 20 }, rect)).toBe(true)
    expect(pointInRect({ x: 110, y: 70 }, rect)).toBe(true)
  })

  test("excludes points outside the rectangle", () => {
    const rect = { x: 10, y: 20, width: 100, height: 50 }

    expect(pointInRect({ x: 9, y: 40 }, rect)).toBe(false)
    expect(pointInRect({ x: 111, y: 40 }, rect)).toBe(false)
    expect(pointInRect({ x: 50, y: 19 }, rect)).toBe(false)
    expect(pointInRect({ x: 50, y: 71 }, rect)).toBe(false)
  })
})

describe("rectsIntersect", () => {
  test("detects overlapping rectangles regardless of argument order", () => {
    const a = { x: 0, y: 0, width: 100, height: 100 }
    const b = { x: 50, y: 50, width: 100, height: 100 }

    expect(rectsIntersect(a, b)).toBe(true)
    expect(rectsIntersect(b, a)).toBe(true)
  })

  test("detects a rectangle fully containing another", () => {
    const outer = { x: 0, y: 0, width: 200, height: 200 }
    const inner = { x: 50, y: 50, width: 20, height: 20 }

    expect(rectsIntersect(outer, inner)).toBe(true)
    expect(rectsIntersect(inner, outer)).toBe(true)
  })

  test("rejects disjoint rectangles", () => {
    const a = { x: 0, y: 0, width: 40, height: 40 }
    const b = { x: 100, y: 100, width: 40, height: 40 }

    expect(rectsIntersect(a, b)).toBe(false)
  })

  test("rejects rectangles that only touch at an edge", () => {
    const a = { x: 0, y: 0, width: 40, height: 40 }
    const b = { x: 40, y: 0, width: 40, height: 40 }

    expect(rectsIntersect(a, b)).toBe(false)
  })
})

describe("translateRect", () => {
  test("moves the rectangle by the delta without changing its size", () => {
    const rect = { x: 8, y: 16, width: 160, height: 96 }

    expect(translateRect(rect, { x: 24, y: -8 })).toEqual({
      x: 32,
      y: 8,
      width: 160,
      height: 96
    })
  })
})

describe("unionRects", () => {
  test("returns null for an empty set", () => {
    expect(unionRects([])).toBeNull()
  })

  test("returns the single rectangle unchanged", () => {
    const rect = { x: 8, y: 8, width: 40, height: 40 }

    expect(unionRects([rect])).toEqual(rect)
  })

  test("returns the bounding rectangle of several rectangles", () => {
    const union = unionRects([
      { x: 0, y: 0, width: 40, height: 40 },
      { x: 100, y: 60, width: 40, height: 40 }
    ])

    expect(union).toEqual({ x: 0, y: 0, width: 140, height: 100 })
  })
})

describe("clampRectPositionToBounds", () => {
  const bounds = { width: 728, height: 4000 }

  test("keeps an in-bounds rectangle where it is", () => {
    const rect = { x: 100, y: 200, width: 160, height: 96 }

    expect(clampRectPositionToBounds(rect, bounds)).toEqual(rect)
  })

  test("clamps negative positions to the content origin", () => {
    const rect = { x: -50, y: -10, width: 160, height: 96 }

    expect(clampRectPositionToBounds(rect, bounds)).toEqual({
      x: 0,
      y: 0,
      width: 160,
      height: 96
    })
  })

  test("clamps positions so the rectangle never crosses the far bounds", () => {
    const rect = { x: 700, y: 3990, width: 160, height: 96 }

    expect(clampRectPositionToBounds(rect, bounds)).toEqual({
      x: 568,
      y: 3904,
      width: 160,
      height: 96
    })
  })

  test("rounds fractional positions to whole pixels without grid quantization", () => {
    const rect = { x: 70.4, y: 113.6, width: 160, height: 96 }

    expect(clampRectPositionToBounds(rect, bounds)).toEqual({
      x: 70,
      y: 114,
      width: 160,
      height: 96
    })
  })
})

describe("normalizeDegrees", () => {
  test("folds any degree value into the canonical [0, 360) range", () => {
    expect(normalizeDegrees(0)).toBe(0)
    expect(normalizeDegrees(360)).toBe(0)
    expect(normalizeDegrees(370)).toBe(10)
    expect(normalizeDegrees(-15)).toBe(345)
    expect(normalizeDegrees(-360)).toBe(0)
    expect(normalizeDegrees(725)).toBe(5)
  })
})

describe("rotatePoint", () => {
  test("returns the point unchanged at rotation 0", () => {
    const point = { x: 12, y: 34 }

    expect(rotatePoint(point, { x: 0, y: 0 }, 0)).toEqual(point)
  })

  test("rotates a point 90 degrees clockwise about a center", () => {
    const rotated = rotatePoint({ x: 10, y: 0 }, { x: 0, y: 0 }, 90)

    expect(rotated.x).toBeCloseTo(0)
    expect(rotated.y).toBeCloseTo(10)
  })

  test("rotates a point 180 degrees to its mirror across the center", () => {
    const rotated = rotatePoint({ x: 10, y: 5 }, { x: 0, y: 0 }, 180)

    expect(rotated.x).toBeCloseTo(-10)
    expect(rotated.y).toBeCloseTo(-5)
  })
})

describe("pointInRotatedRect", () => {
  const rect = { x: 0, y: 0, width: 160, height: 80 }

  test("matches pointInRect at rotation 0", () => {
    expect(pointInRotatedRect({ x: 100, y: 40 }, rect, 0)).toBe(
      pointInRect({ x: 100, y: 40 }, rect)
    )
  })

  test("hits a point outside the unrotated footprint but inside the rotated shape", () => {
    expect(pointInRotatedRect({ x: 100, y: 100 }, rect, 90)).toBe(true)
    expect(pointInRect({ x: 100, y: 100 }, rect)).toBe(false)
  })

  test("misses a point inside the unrotated footprint once rotation moves the shape away", () => {
    expect(pointInRotatedRect({ x: 10, y: 10 }, rect, 90)).toBe(false)
    expect(pointInRect({ x: 10, y: 10 }, rect)).toBe(true)
  })
})

describe("rectsIntersectRotated", () => {
  test("matches rectsIntersect when neither rect is rotated", () => {
    const a = { x: 0, y: 0, width: 100, height: 100 }
    const b = { x: 50, y: 50, width: 100, height: 100 }

    expect(rectsIntersectRotated(a, 0, b, 0)).toBe(rectsIntersect(a, b))
  })

  test("catches an overlap a plain axis-aligned test would miss once one rect is rotated", () => {
    const rotated = { x: 0, y: 0, width: 160, height: 80 }
    const marquee = { x: 90, y: 90, width: 20, height: 20 }

    expect(rectsIntersectRotated(rotated, 90, marquee, 0)).toBe(true)
    expect(rectsIntersect(rotated, marquee)).toBe(false)
  })

  test("rejects rects that stay disjoint after rotation", () => {
    const rotated = { x: 0, y: 0, width: 160, height: 80 }
    const faraway = { x: 1000, y: 1000, width: 20, height: 20 }

    expect(rectsIntersectRotated(rotated, 45, faraway, 0)).toBe(false)
  })
})

describe("rotatedAabb", () => {
  test("returns the rect unchanged at rotation 0", () => {
    const rect = { x: 10, y: 20, width: 100, height: 50 }

    expect(rotatedAabb(rect, 0)).toEqual(rect)
  })

  test("returns the tight bounding box of the rotated corners", () => {
    const rect = { x: 0, y: 0, width: 160, height: 80 }

    expect(rotatedAabb(rect, 90)).toEqual({ x: 40, y: -40, width: 80, height: 160 })
  })

  test("keeps a square's bounding box unchanged under a 90 degree rotation", () => {
    const square = { x: 100, y: 200, width: 80, height: 80 }

    const aabb = rotatedAabb(square, 90)

    expect(aabb.x).toBeCloseTo(square.x)
    expect(aabb.y).toBeCloseTo(square.y)
    expect(aabb.width).toBeCloseTo(square.width)
    expect(aabb.height).toBeCloseTo(square.height)
  })
})

describe("shiftSpanIntoRange", () => {
  test("returns zero when the span already fits", () => {
    expect(shiftSpanIntoRange(10, 90, 100)).toBe(0)
  })

  test("pushes a span starting below zero fully back inside, as a whole pixel", () => {
    expect(shiftSpanIntoRange(-12.3, 40, 100)).toBe(13)
  })

  test("pulls a span past the bound fully back inside, as a whole pixel", () => {
    expect(shiftSpanIntoRange(60, 112.4, 100)).toBe(-13)
  })

  test("pins an oversized span at zero instead of past the bound", () => {
    expect(shiftSpanIntoRange(10, 130, 100)).toBe(-10)
  })
})

describe("clampRotatedRectPositionToBounds", () => {
  const bounds = { width: 400, height: 400 }

  test("matches clampRectPositionToBounds at rotation 0", () => {
    const rect = { x: -20, y: 380, width: 100, height: 50 }

    expect(clampRotatedRectPositionToBounds(rect, 0, bounds)).toEqual(
      clampRectPositionToBounds(rect, bounds)
    )
  })

  test("translates a rotated rect so its rotated footprint stays inside the bounds", () => {
    const rect = { x: 0, y: 0, width: 100, height: 40 }

    const clamped = clampRotatedRectPositionToBounds(rect, 90, bounds)
    const aabb = rotatedAabb(clamped, 90)

    expect(clamped.width).toBe(100)
    expect(clamped.height).toBe(40)
    expect(aabb.x).toBeGreaterThanOrEqual(0)
    expect(aabb.y).toBeGreaterThanOrEqual(0)
  })

  test("leaves an in-bounds rotated rect untouched", () => {
    const rect = { x: 150, y: 150, width: 100, height: 40 }

    expect(clampRotatedRectPositionToBounds(rect, 45, bounds)).toEqual(rect)
  })
})

describe("fitRotatedRectWithinBounds", () => {
  const bounds = { width: 400, height: 400 }

  test("returns the rect unchanged when its rotated footprint already fits", () => {
    const rect = { x: 100, y: 100, width: 100, height: 40 }

    expect(fitRotatedRectWithinBounds(rect, 30, bounds)).toEqual(rect)
  })

  test("translates a rotated rect whose footprint pokes out without resizing it", () => {
    const rect = { x: 0, y: 0, width: 100, height: 40 }

    const fitted = fitRotatedRectWithinBounds(rect, 45, bounds)
    const aabb = rotatedAabb(fitted, 45)

    expect(fitted.width).toBe(100)
    expect(fitted.height).toBe(40)
    expect(aabb.x).toBeGreaterThanOrEqual(0)
    expect(aabb.y).toBeGreaterThanOrEqual(0)
  })

  test("scales an oversized rotated rect down until its footprint fits", () => {
    const rect = { x: 0, y: 0, width: 500, height: 100 }

    const fitted = fitRotatedRectWithinBounds(rect, 45, bounds)
    const aabb = rotatedAabb(fitted, 45)

    expect(fitted.width).toBeLessThan(500)
    expect(aabb.x).toBeGreaterThanOrEqual(0)
    expect(aabb.y).toBeGreaterThanOrEqual(0)
    expect(aabb.x + aabb.width).toBeLessThanOrEqual(bounds.width)
    expect(aabb.y + aabb.height).toBeLessThanOrEqual(bounds.height)
  })
})

describe("floorRotatedRectAtOrigin", () => {
  test("translates the rect so its rotated footprint clears the origin", () => {
    const rect = { x: 10, y: 10, width: 100, height: 40 }

    const floored = floorRotatedRectAtOrigin(rect, 90, { x: 20, y: 20 })
    const aabb = rotatedAabb(floored, 90)

    expect(aabb.x).toBeGreaterThanOrEqual(20)
    expect(aabb.y).toBeGreaterThanOrEqual(20)
    expect(floored.width).toBe(100)
    expect(floored.height).toBe(40)
  })

  test("leaves a rect already past the origin untouched", () => {
    const rect = { x: 200, y: 200, width: 100, height: 40 }

    expect(floorRotatedRectAtOrigin(rect, 45, { x: 20, y: 20 })).toEqual(rect)
  })
})
