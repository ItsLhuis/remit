import { describe, expect, test } from "vitest"

import { makeGroupBlock, makeShapeBlock } from "@/tests/factories/blocks"

import { rotatedAabb } from "../geometry"
import { deriveGroupLayout, normalizeGroups, rectFromPoints } from "../groupBounds"

describe("rectFromPoints", () => {
  test("builds the rect from a top-left to bottom-right drag", () => {
    expect(rectFromPoints({ x: 10, y: 20 }, { x: 110, y: 70 })).toEqual({
      x: 10,
      y: 20,
      width: 100,
      height: 50
    })
  })

  test("normalizes a bottom-right to top-left drag to the same rect", () => {
    expect(rectFromPoints({ x: 110, y: 70 }, { x: 10, y: 20 })).toEqual({
      x: 10,
      y: 20,
      width: 100,
      height: 50
    })
  })

  test("normalizes mixed-direction drags corner by corner", () => {
    expect(rectFromPoints({ x: 110, y: 20 }, { x: 10, y: 70 })).toEqual({
      x: 10,
      y: 20,
      width: 100,
      height: 50
    })
  })

  test("returns a zero-size rect when both points coincide", () => {
    expect(rectFromPoints({ x: 50, y: 50 }, { x: 50, y: 50 })).toEqual({
      x: 50,
      y: 50,
      width: 0,
      height: 0
    })
  })
})

describe("deriveGroupLayout with rotated children", () => {
  test("unions unrotated children by their raw rects exactly as before", () => {
    const children = [
      makeShapeBlock({ id: "a", layout: { x: 0, y: 0, width: 160, height: 96 } }),
      makeShapeBlock({ id: "b", layout: { x: 240, y: 120, width: 160, height: 96 } })
    ]

    expect(deriveGroupLayout(children)).toEqual({ x: 0, y: 0, width: 400, height: 216 })
  })

  test("encloses a rotated child's visual footprint, not its raw rect", () => {
    const child = makeShapeBlock({
      id: "a",
      layout: { x: 0, y: 0, width: 100, height: 48 },
      rotation: 90
    })

    // A 90° rotation of 100x48 about its center (50, 24) paints at {26, -26, 48, 100}.
    expect(deriveGroupLayout([child])).toEqual({ x: 26, y: -26, width: 48, height: 100 })
  })

  test("snaps a non-axis rotation's fractional bounds outward to whole pixels", () => {
    const child = makeShapeBlock({
      id: "a",
      layout: { x: 0, y: 0, width: 100, height: 48 },
      rotation: 45
    })

    const layout = deriveGroupLayout([child])
    const aabb = rotatedAabb(child.layout, 45)

    if (!layout) throw new Error("expected a layout")

    expect(Number.isInteger(layout.x)).toBe(true)
    expect(Number.isInteger(layout.y)).toBe(true)
    expect(Number.isInteger(layout.width)).toBe(true)
    expect(Number.isInteger(layout.height)).toBe(true)
    expect(layout.x).toBeLessThanOrEqual(aabb.x)
    expect(layout.y).toBeLessThanOrEqual(aabb.y)
    expect(layout.x + layout.width).toBeGreaterThanOrEqual(aabb.x + aabb.width)
    expect(layout.y + layout.height).toBeGreaterThanOrEqual(aabb.y + aabb.height)
  })
})

describe("normalizeGroups with rotated children", () => {
  test("re-derives a group's box to enclose a rotated child already stored inside it", () => {
    const child = makeShapeBlock({
      id: "member",
      layout: { x: 0, y: 0, width: 100, height: 48 },
      rotation: 90
    })
    const group = makeGroupBlock({
      id: "group",
      layout: { x: 100, y: 100, width: 100, height: 48 },
      children: [child]
    })

    const [normalized] = normalizeGroups([group])

    expect(normalized?.layout).toEqual({ x: 126, y: 74, width: 48, height: 100 })

    const rebased = normalized?.type === "group" ? normalized.content.children[0] : undefined

    expect(rebased?.layout).toMatchObject({ x: -26, y: 26 })
  })

  test("reaches a fixed point: a second pass returns the same references", () => {
    const child = makeShapeBlock({
      id: "member",
      layout: { x: 0, y: 0, width: 100, height: 48 },
      rotation: 90
    })
    const group = makeGroupBlock({
      id: "group",
      layout: { x: 100, y: 100, width: 100, height: 48 },
      children: [child]
    })

    const once = normalizeGroups([group])
    const twice = normalizeGroups(once)

    expect(twice).toBe(once)
  })
})
