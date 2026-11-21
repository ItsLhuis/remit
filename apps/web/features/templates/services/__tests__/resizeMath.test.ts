import { describe, expect, test } from "vitest"

import { makeGroupBlock, makeShapeBlock } from "@/tests/factories/blocks"

import { buildIndex, collectResizeMemberIds } from "../blockIndex"
import { clampResizeRectToBounds } from "../canvasLayout"
import {
  anchorResizedRect,
  clampSetScaleFactors,
  isUniformOnly,
  resolveHandleResize,
  scaleBlockSet,
  type ResizeSetMember
} from "../resizeMath"

const MIN_WIDTH = 48
const MIN_HEIGHT = 16

const baseRect = { x: 100, y: 100, width: 200, height: 100 }

describe("resolveHandleResize", () => {
  test("grows the east edge, anchoring the west edge", () => {
    const rect = resolveHandleResize({
      baseRect,
      rotation: 0,
      direction: "e",
      pointerDelta: { x: 50, y: 0 },
      aspectLock: false,
      centerAnchor: false,
      minWidth: MIN_WIDTH,
      minHeight: MIN_HEIGHT
    })

    expect(rect).toEqual({ x: 100, y: 100, width: 250, height: 100 })
  })

  test("grows the west edge, anchoring the east edge", () => {
    const rect = resolveHandleResize({
      baseRect,
      rotation: 0,
      direction: "w",
      pointerDelta: { x: -30, y: 0 },
      aspectLock: false,
      centerAnchor: false,
      minWidth: MIN_WIDTH,
      minHeight: MIN_HEIGHT
    })

    expect(rect).toEqual({ x: 70, y: 100, width: 230, height: 100 })
  })

  test("grows the north edge, anchoring the south edge", () => {
    const rect = resolveHandleResize({
      baseRect,
      rotation: 0,
      direction: "n",
      pointerDelta: { x: 0, y: -20 },
      aspectLock: false,
      centerAnchor: false,
      minWidth: MIN_WIDTH,
      minHeight: MIN_HEIGHT
    })

    expect(rect).toEqual({ x: 100, y: 80, width: 200, height: 120 })
  })

  test("grows the south edge, anchoring the north edge", () => {
    const rect = resolveHandleResize({
      baseRect,
      rotation: 0,
      direction: "s",
      pointerDelta: { x: 0, y: 40 },
      aspectLock: false,
      centerAnchor: false,
      minWidth: MIN_WIDTH,
      minHeight: MIN_HEIGHT
    })

    expect(rect).toEqual({ x: 100, y: 100, width: 200, height: 140 })
  })

  test("corner se grows both axes, anchoring the opposite corner", () => {
    const rect = resolveHandleResize({
      baseRect,
      rotation: 0,
      direction: "se",
      pointerDelta: { x: 40, y: 20 },
      aspectLock: false,
      centerAnchor: false,
      minWidth: MIN_WIDTH,
      minHeight: MIN_HEIGHT
    })

    expect(rect).toEqual({ x: 100, y: 100, width: 240, height: 120 })
  })

  test("corner nw grows both axes, anchoring the opposite corner", () => {
    const rect = resolveHandleResize({
      baseRect,
      rotation: 0,
      direction: "nw",
      pointerDelta: { x: -30, y: -10 },
      aspectLock: false,
      centerAnchor: false,
      minWidth: MIN_WIDTH,
      minHeight: MIN_HEIGHT
    })

    expect(rect).toEqual({ x: 70, y: 90, width: 230, height: 110 })
  })

  test("corner ne grows both axes, anchoring the opposite corner", () => {
    const rect = resolveHandleResize({
      baseRect,
      rotation: 0,
      direction: "ne",
      pointerDelta: { x: 20, y: -10 },
      aspectLock: false,
      centerAnchor: false,
      minWidth: MIN_WIDTH,
      minHeight: MIN_HEIGHT
    })

    expect(rect).toEqual({ x: 100, y: 90, width: 220, height: 110 })
  })

  test("corner sw grows both axes, anchoring the opposite corner", () => {
    const rect = resolveHandleResize({
      baseRect,
      rotation: 0,
      direction: "sw",
      pointerDelta: { x: -20, y: 10 },
      aspectLock: false,
      centerAnchor: false,
      minWidth: MIN_WIDTH,
      minHeight: MIN_HEIGHT
    })

    expect(rect).toEqual({ x: 80, y: 100, width: 220, height: 110 })
  })

  test("Alt anchors the center so an edge handle grows both symmetric edges", () => {
    const rect = resolveHandleResize({
      baseRect,
      rotation: 0,
      direction: "e",
      pointerDelta: { x: 50, y: 0 },
      aspectLock: false,
      centerAnchor: true,
      minWidth: MIN_WIDTH,
      minHeight: MIN_HEIGHT
    })

    expect(rect).toEqual({ x: 50, y: 100, width: 300, height: 100 })
  })

  test("Alt anchors the center for a corner handle on both axes", () => {
    const rect = resolveHandleResize({
      baseRect,
      rotation: 0,
      direction: "se",
      pointerDelta: { x: 20, y: 10 },
      aspectLock: false,
      centerAnchor: true,
      minWidth: MIN_WIDTH,
      minHeight: MIN_HEIGHT
    })

    expect(rect).toEqual({ x: 80, y: 90, width: 240, height: 120 })
  })

  test("Shift locks the aspect ratio for a corner handle to the dominant axis", () => {
    const rect = resolveHandleResize({
      baseRect,
      rotation: 0,
      direction: "se",
      pointerDelta: { x: 40, y: 0 },
      aspectLock: true,
      centerAnchor: false,
      minWidth: MIN_WIDTH,
      minHeight: MIN_HEIGHT
    })

    expect(rect).toEqual({ x: 100, y: 100, width: 240, height: 120 })
  })

  test("Shift on an edge handle derives the cross axis from the driven axis's scale", () => {
    const rect = resolveHandleResize({
      baseRect,
      rotation: 0,
      direction: "e",
      pointerDelta: { x: 40, y: 0 },
      aspectLock: true,
      centerAnchor: false,
      minWidth: MIN_WIDTH,
      minHeight: MIN_HEIGHT
    })

    expect(rect).toEqual({ x: 100, y: 100, width: 240, height: 120 })
  })

  test("Shift+Alt scales uniformly about the center for a corner handle", () => {
    const rect = resolveHandleResize({
      baseRect,
      rotation: 0,
      direction: "se",
      pointerDelta: { x: 40, y: 0 },
      aspectLock: true,
      centerAnchor: true,
      minWidth: MIN_WIDTH,
      minHeight: MIN_HEIGHT
    })

    expect(rect).toEqual({ x: 60, y: 80, width: 280, height: 140 })
  })

  test("Shift+Alt scales uniformly about the center for an edge handle", () => {
    const rect = resolveHandleResize({
      baseRect,
      rotation: 0,
      direction: "e",
      pointerDelta: { x: 40, y: 0 },
      aspectLock: true,
      centerAnchor: true,
      minWidth: MIN_WIDTH,
      minHeight: MIN_HEIGHT
    })

    expect(rect).toEqual({ x: 60, y: 80, width: 280, height: 140 })
  })

  test("the west edge stops at the anchor minus the minimum width", () => {
    const rect = resolveHandleResize({
      baseRect,
      rotation: 0,
      direction: "w",
      pointerDelta: { x: 190, y: 0 },
      aspectLock: false,
      centerAnchor: false,
      minWidth: MIN_WIDTH,
      minHeight: MIN_HEIGHT
    })

    expect(rect).toEqual({ x: 252, y: 100, width: 48, height: 100 })
  })

  test("the north edge stops at the anchor minus the minimum height", () => {
    const rect = resolveHandleResize({
      baseRect,
      rotation: 0,
      direction: "n",
      pointerDelta: { x: 0, y: 95 },
      aspectLock: false,
      centerAnchor: false,
      minWidth: MIN_WIDTH,
      minHeight: MIN_HEIGHT
    })

    expect(rect).toEqual({ x: 100, y: 184, width: 200, height: 16 })
  })

  test("a corner handle floors each axis independently at the minimum size", () => {
    const rect = resolveHandleResize({
      baseRect,
      rotation: 0,
      direction: "nw",
      pointerDelta: { x: 190, y: 95 },
      aspectLock: false,
      centerAnchor: false,
      minWidth: MIN_WIDTH,
      minHeight: MIN_HEIGHT
    })

    expect(rect).toEqual({ x: 252, y: 184, width: 48, height: 16 })
  })

  test("composes with the resize page-bounds clamp for a top-level resize", () => {
    const bounds = { width: 728, height: 4000 }

    const rect = resolveHandleResize({
      baseRect: { x: 0, y: 0, width: 160, height: 96 },
      rotation: 0,
      direction: "e",
      pointerDelta: { x: 5000, y: 0 },
      aspectLock: false,
      centerAnchor: false,
      minWidth: MIN_WIDTH,
      minHeight: MIN_HEIGHT
    })

    const clamped = clampResizeRectToBounds(rect, bounds)

    expect(clamped.rect).toEqual({ x: 0, y: 0, width: 728, height: 96 })
    expect(clamped.limits).toEqual({ right: 728 })
  })
})

describe("anchorResizedRect", () => {
  test("keeps the opposite corner fixed when re-anchoring an adjusted size", () => {
    const rect = anchorResizedRect(baseRect, "nw", false, { width: 160, height: 80 })

    expect(rect).toEqual({ x: 140, y: 120, width: 160, height: 80 })
  })

  test("keeps the center fixed when re-anchoring with the center anchor", () => {
    const rect = anchorResizedRect(baseRect, "se", true, { width: 100, height: 60 })

    expect(rect).toEqual({ x: 150, y: 120, width: 100, height: 60 })
  })
})

describe("scaleBlockSet", () => {
  test("a one-member set reproduces the next reference rect exactly", () => {
    const members: ResizeSetMember[] = [{ id: "a", rect: baseRect, rotation: 0 }]
    const nextReference = { x: 70, y: 90, width: 230, height: 110 }

    const scaled = scaleBlockSet(members, baseRect, nextReference)

    expect(scaled.get("a")).toEqual({ rect: nextReference, rotation: 0 })
  })

  test("maps a multi-member set's positions and sizes proportionally", () => {
    const reference = { x: 0, y: 0, width: 200, height: 100 }
    const members: ResizeSetMember[] = [
      { id: "a", rect: { x: 0, y: 0, width: 100, height: 50 }, rotation: 0 },
      { id: "b", rect: { x: 100, y: 50, width: 100, height: 50 }, rotation: 0 }
    ]

    const scaled = scaleBlockSet(members, reference, { x: 0, y: 0, width: 400, height: 200 })

    expect(scaled.get("a")).toEqual({ rect: { x: 0, y: 0, width: 200, height: 100 }, rotation: 0 })
    expect(scaled.get("b")).toEqual({
      rect: { x: 200, y: 100, width: 200, height: 100 },
      rotation: 0
    })
  })

  test("scales a nested descendant with its ancestor when both are members", () => {
    const reference = { x: 0, y: 0, width: 200, height: 200 }
    const members: ResizeSetMember[] = [
      { id: "frame", rect: { x: 0, y: 0, width: 200, height: 200 }, rotation: 0 },
      { id: "child", rect: { x: 20, y: 20, width: 40, height: 40 }, rotation: 0 }
    ]

    const scaled = scaleBlockSet(members, reference, { x: 0, y: 0, width: 400, height: 400 })

    expect(scaled.get("child")).toEqual({
      rect: { x: 40, y: 40, width: 80, height: 80 },
      rotation: 0
    })
  })

  test("keeps a rotated member's rotation while its rect scales, staying a plain rectangle", () => {
    const reference = { x: 0, y: 0, width: 200, height: 100 }
    const members: ResizeSetMember[] = [
      { id: "rotated", rect: { x: 50, y: 25, width: 100, height: 50 }, rotation: 30 }
    ]

    const scaled = scaleBlockSet(members, reference, { x: 0, y: 0, width: 400, height: 200 })

    expect(scaled.get("rotated")).toEqual({
      rect: { x: 100, y: 50, width: 200, height: 100 },
      rotation: 30
    })
  })
})

describe("clampSetScaleFactors", () => {
  test("leaves factors untouched when every member stays above the minimum", () => {
    const members: ResizeSetMember[] = [
      { id: "a", rect: { x: 0, y: 0, width: 100, height: 50 }, rotation: 0 }
    ]

    const factors = clampSetScaleFactors(
      members,
      baseRect,
      { scaleX: 0.5, scaleY: 0.5 },
      { width: 48, height: 16 }
    )

    expect(factors).toEqual({ scaleX: 0.5, scaleY: 0.5 })
  })

  test("floors the scale so no member drops below the minimum size", () => {
    const members: ResizeSetMember[] = [
      { id: "a", rect: { x: 0, y: 0, width: 100, height: 50 }, rotation: 0 }
    ]

    const factors = clampSetScaleFactors(
      members,
      baseRect,
      { scaleX: 0.2, scaleY: 0.2 },
      { width: 48, height: 16 }
    )

    expect(factors).toEqual({ scaleX: 0.48, scaleY: 0.32 })
  })

  test("stops the whole set together when any single member would pass the minimum", () => {
    const members: ResizeSetMember[] = [
      { id: "big", rect: { x: 0, y: 0, width: 400, height: 200 }, rotation: 0 },
      { id: "small", rect: { x: 0, y: 0, width: 60, height: 20 }, rotation: 0 }
    ]

    const factors = clampSetScaleFactors(
      members,
      baseRect,
      { scaleX: 0.5, scaleY: 0.5 },
      { width: 48, height: 16 }
    )

    expect(factors).toEqual({ scaleX: 0.8, scaleY: 0.8 })
  })

  test("never lowers a factor that was requested to grow", () => {
    const members: ResizeSetMember[] = [
      { id: "a", rect: { x: 0, y: 0, width: 30, height: 20 }, rotation: 0 }
    ]

    const factors = clampSetScaleFactors(
      members,
      baseRect,
      { scaleX: 2, scaleY: 2 },
      { width: 48, height: 16 }
    )

    expect(factors).toEqual({ scaleX: 2, scaleY: 2 })
  })
})

describe("isUniformOnly", () => {
  test("is false when every member is unrotated", () => {
    const members: ResizeSetMember[] = [
      { id: "a", rect: baseRect, rotation: 0 },
      { id: "b", rect: baseRect, rotation: 0 }
    ]

    expect(isUniformOnly(members)).toBe(false)
  })

  test("is true when any member, including a nested descendant, carries rotation", () => {
    const members: ResizeSetMember[] = [
      { id: "frame", rect: baseRect, rotation: 0 },
      { id: "child", rect: baseRect, rotation: 15 }
    ]

    expect(isUniformOnly(members)).toBe(true)
  })

  test("a rotated descendant nested inside a selected group forces uniform through the flattened member set", () => {
    const rotatedChild = makeShapeBlock({
      id: "rotated",
      layout: { x: 0, y: 0, width: 96, height: 96 },
      rotation: 15
    })
    const plainChild = makeShapeBlock({
      id: "plain",
      layout: { x: 200, y: 0, width: 96, height: 96 }
    })
    const group = makeGroupBlock({
      id: "group",
      layout: { x: 0, y: 0, width: 296, height: 96 },
      children: [rotatedChild, plainChild]
    })
    const index = buildIndex([group])

    const members: ResizeSetMember[] = collectResizeMemberIds(index, ["group"]).map((id) => {
      const entry = index.get(id)

      if (!entry) throw new Error(`missing index entry for ${id}`)

      return { id, rect: entry.pageRect, rotation: entry.rotation }
    })

    expect(members.map((member) => member.id).toSorted()).toEqual(["group", "plain", "rotated"])
    expect(isUniformOnly(members)).toBe(true)
  })
})

describe("uniform fallback via forced aspect lock", () => {
  test("an edge handle derives both scale factors from its own axis", () => {
    const rect = resolveHandleResize({
      baseRect,
      rotation: 0,
      direction: "s",
      pointerDelta: { x: 0, y: 50 },
      aspectLock: true,
      centerAnchor: false,
      minWidth: MIN_WIDTH,
      minHeight: MIN_HEIGHT
    })

    expect(rect).toEqual({ x: 100, y: 100, width: 300, height: 150 })
  })

  test("a corner handle under the forced lock scales both axes by one factor", () => {
    const rect = resolveHandleResize({
      baseRect,
      rotation: 0,
      direction: "se",
      pointerDelta: { x: 100, y: 10 },
      aspectLock: true,
      centerAnchor: false,
      minWidth: MIN_WIDTH,
      minHeight: MIN_HEIGHT
    })

    expect(rect.width / baseRect.width).toBeCloseTo(rect.height / baseRect.height)
  })
})
