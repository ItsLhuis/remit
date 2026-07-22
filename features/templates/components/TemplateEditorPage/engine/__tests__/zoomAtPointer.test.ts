import { describe, expect, test } from "vitest"

import { nextZoomForWheelDelta, resolveZoomAtPointerScroll } from "../zoomAtPointer"

describe("resolveZoomAtPointerScroll", () => {
  test("keeps the canvas point under the pointer fixed when zooming in", () => {
    const next = resolveZoomAtPointerScroll({
      pointer: { x: 300, y: 200 },
      containerOrigin: { x: 50, y: 20 },
      scroll: { x: 100, y: 40 },
      previousZoom: 1,
      nextZoom: 2
    })

    expect(next).toEqual({ x: 450, y: 260 })
  })

  test("keeps the canvas point under the pointer fixed when zooming out", () => {
    const next = resolveZoomAtPointerScroll({
      pointer: { x: 300, y: 200 },
      containerOrigin: { x: 50, y: 20 },
      scroll: { x: 350, y: 220 },
      previousZoom: 2,
      nextZoom: 1
    })

    expect(next).toEqual({ x: 50, y: 20 })
  })

  test("returns the unchanged scroll when the zoom does not change", () => {
    const next = resolveZoomAtPointerScroll({
      pointer: { x: 300, y: 200 },
      containerOrigin: { x: 50, y: 20 },
      scroll: { x: 137, y: 64 },
      previousZoom: 1.25,
      nextZoom: 1.25
    })

    expect(next).toEqual({ x: 137, y: 64 })
  })

  test("reproduces the same canvas-space point under the pointer before and after zoom", () => {
    const input = {
      pointer: { x: 412, y: 288 },
      containerOrigin: { x: 16, y: 8 },
      scroll: { x: 220, y: 96 },
      previousZoom: 0.75,
      nextZoom: 1.5
    }

    const next = resolveZoomAtPointerScroll(input)

    const offsetX = input.pointer.x - input.containerOrigin.x
    const offsetY = input.pointer.y - input.containerOrigin.y
    const canvasPointBefore = {
      x: (input.scroll.x + offsetX) / input.previousZoom,
      y: (input.scroll.y + offsetY) / input.previousZoom
    }
    const canvasPointAfter = {
      x: (next.x + offsetX) / input.nextZoom,
      y: (next.y + offsetY) / input.nextZoom
    }

    expect(canvasPointAfter.x).toBeCloseTo(canvasPointBefore.x)
    expect(canvasPointAfter.y).toBeCloseTo(canvasPointBefore.y)
  })
})

describe("nextZoomForWheelDelta", () => {
  test("increases zoom when scrolling up (negative deltaY)", () => {
    const next = nextZoomForWheelDelta(1, -100)

    expect(next).toBeGreaterThan(1)
  })

  test("decreases zoom when scrolling down (positive deltaY)", () => {
    const next = nextZoomForWheelDelta(1, 100)

    expect(next).toBeLessThan(1)
  })

  test("returns the unchanged zoom for a zero delta", () => {
    const next = nextZoomForWheelDelta(1.25, 0)

    expect(next).toBe(1.25)
  })
})
