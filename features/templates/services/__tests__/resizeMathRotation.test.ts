import { describe, expect, test } from "vitest"

import { type Rect } from "../canvasLayout"
import { rotatePoint, type Point } from "../geometry"
import {
  anchorResizedRect,
  anchorResizedRectRotated,
  resolveHandleResize,
  type HandleDirection
} from "../resizeMath"

const MIN_WIDTH = 48
const MIN_HEIGHT = 16

const baseRect = { x: 100, y: 100, width: 200, height: 100 }

describe("resolveHandleResize with rotation", () => {
  function resolveRotated(rotation: number, direction: HandleDirection, pointerDelta: Point): Rect {
    return resolveHandleResize({
      baseRect,
      rotation,
      direction,
      pointerDelta,
      aspectLock: false,
      centerAnchor: false,
      minWidth: MIN_WIDTH,
      minHeight: MIN_HEIGHT
    })
  }

  function expectRectCloseTo(rect: Rect, expected: Rect) {
    expect(rect.x).toBeCloseTo(expected.x)
    expect(rect.y).toBeCloseTo(expected.y)
    expect(rect.width).toBeCloseTo(expected.width)
    expect(rect.height).toBeCloseTo(expected.height)
  }

  test("projects the pointer into the block's rotated frame so the handle follows its visual direction", () => {
    const rect = resolveRotated(90, "e", { x: 0, y: 50 })

    expectRectCloseTo(rect, { x: 75, y: 125, width: 250, height: 100 })
  })

  test("keeps the dragged handle's opposite edge visually fixed for a rotated block", () => {
    const rect = resolveRotated(90, "e", { x: 0, y: 50 })

    const visualWestMidpoint = (target: Rect) =>
      rotatePoint(
        { x: target.x, y: target.y + target.height / 2 },
        { x: target.x + target.width / 2, y: target.y + target.height / 2 },
        90
      )

    const before = visualWestMidpoint(baseRect)
    const after = visualWestMidpoint(rect)

    expect(after.x).toBeCloseTo(before.x)
    expect(after.y).toBeCloseTo(before.y)
  })

  test("a rotated block's own edge handle stays fully non-uniform, resizing one local axis only", () => {
    const rect = resolveRotated(90, "s", { x: -30, y: 0 })

    expectRectCloseTo(rect, { x: 85, y: 85, width: 200, height: 130 })
  })

  test("a 180 degree rotation inverts the pointer mapping while the anchor corner stays fixed", () => {
    const rect = resolveRotated(180, "se", { x: -40, y: -20 })

    expectRectCloseTo(rect, { x: 60, y: 80, width: 240, height: 120 })
  })
})

describe("anchorResizedRectRotated", () => {
  test("reduces exactly to anchorResizedRect at rotation 0", () => {
    const grow = { width: 160, height: 80 }
    const shrink = { width: 100, height: 60 }

    expect(
      anchorResizedRectRotated({
        baseRect,
        rotation: 0,
        direction: "nw",
        centerAnchor: false,
        size: grow
      })
    ).toEqual(anchorResizedRect(baseRect, "nw", false, grow))
    expect(
      anchorResizedRectRotated({
        baseRect,
        rotation: 0,
        direction: "se",
        centerAnchor: true,
        size: shrink
      })
    ).toEqual(anchorResizedRect(baseRect, "se", true, shrink))
  })

  test("keeps the center visually fixed when re-anchoring a rotated rect about its center", () => {
    const rect = anchorResizedRectRotated({
      baseRect,
      rotation: 45,
      direction: "se",
      centerAnchor: true,
      size: { width: 100, height: 60 }
    })

    expect(rect.x + rect.width / 2).toBeCloseTo(baseRect.x + baseRect.width / 2)
    expect(rect.y + rect.height / 2).toBeCloseTo(baseRect.y + baseRect.height / 2)
  })
})
