import { describe, expect, test } from "vitest"

import { resolveMoveUpdate } from "../gestures"

const bounds = { width: 728, height: 4000 }

describe("resolveMoveUpdate", () => {
  const baseRects = new Map([["a", { x: 80, y: 80, width: 160, height: 96 }]])

  test("snaps the moved position to the grid by default", () => {
    const update = resolveMoveUpdate({
      baseRects,
      origin: { x: 100, y: 100 },
      point: { x: 121, y: 135 },
      axisLocked: false,
      snap: true,
      clamp: true,
      bounds
    })

    expect(update.delta).toEqual({ x: 24, y: 32 })
    expect(update.rects.get("a")).toEqual({ x: 104, y: 112, width: 160, height: 96 })
  })

  test("moves in whole pixels when snapping is bypassed", () => {
    const update = resolveMoveUpdate({
      baseRects,
      origin: { x: 100, y: 100 },
      point: { x: 121.4, y: 135.2 },
      axisLocked: false,
      snap: false,
      clamp: true,
      bounds
    })

    expect(update.delta).toEqual({ x: 21, y: 35 })
  })

  test("locks to the dominant axis while Shift is held", () => {
    const update = resolveMoveUpdate({
      baseRects,
      origin: { x: 100, y: 100 },
      point: { x: 164, y: 116 },
      axisLocked: true,
      snap: true,
      clamp: true,
      bounds
    })

    expect(update.delta).toEqual({ x: 64, y: 0 })
  })

  test("clamps the set's union rect into the content bounds", () => {
    const update = resolveMoveUpdate({
      baseRects,
      origin: { x: 100, y: 100 },
      point: { x: 5000, y: -5000 },
      axisLocked: false,
      snap: true,
      clamp: true,
      bounds
    })

    expect(update.rects.get("a")).toEqual({ x: 568, y: 0, width: 160, height: 96 })
  })

  test("leaves a child-only set unclamped by the page", () => {
    const update = resolveMoveUpdate({
      baseRects,
      origin: { x: 100, y: 100 },
      point: { x: -5000, y: 100 },
      axisLocked: false,
      snap: true,
      clamp: false,
      bounds
    })

    expect(update.rects.get("a")?.x).toBeLessThan(0)
  })

  // Per-frame math must floor a child rect at its parent frame's page origin, the
  // same floor moveBlocks applies at commit, so the drag preview and the committed position are
  // identical and dropping never "snaps" into place.
  test("floors a child rect at its frame's page origin during per-frame preview, matching moveBlocks", () => {
    const childBaseRects = new Map([["child", { x: 96, y: 96, width: 96, height: 32 }]])
    const parentRects = new Map([["child", { x: 80, y: 80, width: 480, height: 240 }]])

    const update = resolveMoveUpdate({
      baseRects: childBaseRects,
      origin: { x: 100, y: 100 },
      point: { x: -5000, y: -5000 },
      axisLocked: false,
      snap: true,
      clamp: false,
      bounds,
      parentRects
    })

    expect(update.rects.get("child")).toEqual({ x: 80, y: 80, width: 96, height: 32 })
  })

  // A Ctrl-marquee can catch a top-level block together with a frame child that overflows past
  // the frame's own edge. The union that clamps the drag must come from the top-level member
  // alone (matching moveBlocks's commit-time union) or a mixed selection stops earlier while
  // dragging than the same selection allows when nudged by arrow keys.
  test("clamps a mixed top-level and frame-child selection using only the top-level member's union", () => {
    const mixedBaseRects = new Map([
      ["a", { x: 80, y: 80, width: 160, height: 96 }],
      ["child", { x: 500, y: 80, width: 160, height: 96 }]
    ])
    const parentRects = new Map([["child", { x: 400, y: 0, width: 300, height: 240 }]])

    const update = resolveMoveUpdate({
      baseRects: mixedBaseRects,
      origin: { x: 100, y: 100 },
      point: { x: 5100, y: 100 },
      axisLocked: false,
      snap: true,
      clamp: true,
      bounds,
      parentRects
    })

    expect(update.rects.get("a")).toEqual({ x: 568, y: 80, width: 160, height: 96 })
    expect(update.rects.get("child")).toEqual({ x: 988, y: 80, width: 160, height: 96 })
  })

  // With no top-level member in the set at all, there is nothing to clamp against the page: both
  // frame children float freely past the content bounds, exactly like moveBlocks's commit-time
  // union (which is also empty for a children-only set).
  test("leaves a multi-member frame-child-only selection unclamped by the page", () => {
    const childBaseRects = new Map([
      ["first", { x: 96, y: 96, width: 96, height: 32 }],
      ["second", { x: 96, y: 160, width: 96, height: 32 }]
    ])
    const parentRects = new Map([
      ["first", { x: 80, y: 80, width: 480, height: 240 }],
      ["second", { x: 80, y: 80, width: 480, height: 240 }]
    ])

    const update = resolveMoveUpdate({
      baseRects: childBaseRects,
      origin: { x: 100, y: 100 },
      point: { x: 5000, y: 100 },
      axisLocked: false,
      snap: true,
      clamp: false,
      bounds,
      parentRects
    })

    expect(update.rects.get("first")?.x).toBeGreaterThan(bounds.width)
    expect(update.rects.get("second")?.x).toBeGreaterThan(bounds.width)
  })
})
