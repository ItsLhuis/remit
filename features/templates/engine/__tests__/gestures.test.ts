import { describe, expect, test } from "vitest"

import { makeFrameBlock, makeShapeBlock, makeTextBlock } from "@/tests/factories/blocks"

import {
  buildIndex,
  rotatedAabb,
  rotatePoint,
  type Point,
  type Rect,
  type ResizeSetMember
} from "../../services"
import {
  classifyPress,
  collectResizeSet,
  descendAt,
  reparentTargetAt,
  resolveMarqueeSelection,
  resolveResizeUpdate,
  textEditTargetAt
} from "../gestures"

function pageCorner(rect: Rect, rotation: number, fx: number, fy: number): Point {
  const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }

  return rotatePoint(
    { x: rect.x + fx * rect.width, y: rect.y + fy * rect.height },
    center,
    rotation
  )
}

describe("classifyPress", () => {
  test("classifies empty page as empty", () => {
    const index = buildIndex([makeShapeBlock({ id: "a", layout: { x: 0, y: 0 } })])

    const result = classifyPress({
      index,
      point: { x: 500, y: 500 },
      selection: new Set(),
      deepSelect: false,
      toggle: false
    })

    expect(result).toEqual({ kind: "empty" })
  })

  test("selects the top-level ancestor of the hit and arms a move", () => {
    const child = makeTextBlock({ id: "child", layout: { x: 16, y: 16, width: 96, height: 32 } })
    const index = buildIndex([
      makeFrameBlock({ id: "frame", layout: { x: 80, y: 80 }, children: [child] })
    ])

    const result = classifyPress({
      index,
      point: { x: 100, y: 100 },
      selection: new Set(),
      deepSelect: false,
      toggle: false
    })

    expect(result).toEqual({ kind: "move", ids: ["frame"], selectId: "frame" })
  })

  test("deep-selects the deepest hit with the modifier held", () => {
    const child = makeTextBlock({ id: "child", layout: { x: 16, y: 16, width: 96, height: 32 } })
    const index = buildIndex([
      makeFrameBlock({ id: "frame", layout: { x: 80, y: 80 }, children: [child] })
    ])

    const result = classifyPress({
      index,
      point: { x: 100, y: 100 },
      selection: new Set(),
      deepSelect: true,
      toggle: false
    })

    expect(result).toEqual({ kind: "move", ids: ["child"], selectId: "child" })
  })

  test("shift toggles the top-level ancestor without arming a move", () => {
    const index = buildIndex([makeShapeBlock({ id: "a", layout: { x: 0, y: 0 } })])

    const result = classifyPress({
      index,
      point: { x: 10, y: 10 },
      selection: new Set(),
      deepSelect: false,
      toggle: true
    })

    expect(result).toEqual({ kind: "toggle", id: "a" })
  })

  test("keeps the current selection when the hit is inside it", () => {
    const child = makeTextBlock({ id: "child", layout: { x: 16, y: 16, width: 96, height: 32 } })
    const index = buildIndex([
      makeFrameBlock({ id: "frame", layout: { x: 80, y: 80 }, children: [child] })
    ])

    const result = classifyPress({
      index,
      point: { x: 100, y: 100 },
      selection: new Set(["frame"]),
      deepSelect: false,
      toggle: false
    })

    expect(result).toEqual({ kind: "move", ids: ["frame"], selectId: null })
  })

  test("moves a drilled-in child selection when the pointer presses on it", () => {
    const child = makeTextBlock({ id: "child", layout: { x: 16, y: 16, width: 96, height: 32 } })
    const index = buildIndex([
      makeFrameBlock({ id: "frame", layout: { x: 80, y: 80 }, children: [child] })
    ])

    const result = classifyPress({
      index,
      point: { x: 100, y: 100 },
      selection: new Set(["child"]),
      deepSelect: false,
      toggle: false
    })

    expect(result).toEqual({ kind: "move", ids: ["child"], selectId: null })
  })

  test("targets the sibling at the drilled-in depth instead of the top-level ancestor", () => {
    const first = makeTextBlock({ id: "first", layout: { x: 16, y: 16, width: 96, height: 32 } })
    const second = makeTextBlock({ id: "second", layout: { x: 16, y: 96, width: 96, height: 32 } })
    const index = buildIndex([
      makeFrameBlock({ id: "frame", layout: { x: 80, y: 80 }, children: [first, second] })
    ])

    const result = classifyPress({
      index,
      point: { x: 100, y: 180 },
      selection: new Set(["first"]),
      deepSelect: false,
      toggle: false
    })

    expect(result).toEqual({ kind: "move", ids: ["second"], selectId: "second" })
  })

  // Pressing an unselected block that overlaps a selected one must select the
  // topmost hit, not carry the selection just because some hit underneath it is selected.
  test("selects the topmost unselected block instead of carrying an overlapped selection", () => {
    const index = buildIndex([
      makeShapeBlock({ id: "a", layout: { x: 0, y: 0, width: 160, height: 96 } }),
      makeShapeBlock({ id: "b", layout: { x: 0, y: 0, width: 160, height: 96 } })
    ])

    const result = classifyPress({
      index,
      point: { x: 50, y: 50 },
      selection: new Set(["a"]),
      deepSelect: false,
      toggle: false
    })

    expect(result).toEqual({ kind: "move", ids: ["b"], selectId: "b" })
  })
})

describe("resolveMarqueeSelection", () => {
  test("replaces the selection with the caught blocks by default", () => {
    expect(resolveMarqueeSelection(new Set(["old"]), ["a", "b"], false)).toEqual(["a", "b"])
  })

  test("clears the selection when a default marquee catches nothing", () => {
    expect(resolveMarqueeSelection(new Set(["old"]), [], false)).toEqual([])
  })

  test("toggles each caught block against the existing selection when additive", () => {
    const next = resolveMarqueeSelection(new Set(["kept", "removed"]), ["removed", "added"], true)

    expect(next.toSorted()).toEqual(["added", "kept"])
  })

  test("keeps the existing selection untouched when an additive marquee catches nothing", () => {
    expect(resolveMarqueeSelection(new Set(["kept"]), [], true)).toEqual(["kept"])
  })
})

describe("descendAt", () => {
  test("descends one level from a single selection toward the block under the pointer", () => {
    const child = makeTextBlock({ id: "child", layout: { x: 16, y: 16, width: 96, height: 32 } })
    const index = buildIndex([
      makeFrameBlock({ id: "frame", layout: { x: 80, y: 80 }, children: [child] })
    ])

    expect(descendAt(index, { x: 100, y: 100 }, new Set(["frame"]))).toBe("child")
  })

  test("selects the top-level ancestor when nothing is selected yet", () => {
    const child = makeTextBlock({ id: "child", layout: { x: 16, y: 16, width: 96, height: 32 } })
    const index = buildIndex([
      makeFrameBlock({ id: "frame", layout: { x: 80, y: 80 }, children: [child] })
    ])

    expect(descendAt(index, { x: 100, y: 100 }, new Set())).toBe("frame")
  })

  test("returns null when the selection is already the deepest hit", () => {
    const child = makeTextBlock({ id: "child", layout: { x: 16, y: 16, width: 96, height: 32 } })
    const index = buildIndex([
      makeFrameBlock({ id: "frame", layout: { x: 80, y: 80 }, children: [child] })
    ])

    expect(descendAt(index, { x: 100, y: 100 }, new Set(["child"]))).toBeNull()
  })

  test("returns null when the point misses every block", () => {
    const index = buildIndex([makeShapeBlock({ id: "a", layout: { x: 0, y: 0 } })])

    expect(descendAt(index, { x: 900, y: 900 }, new Set(["a"]))).toBeNull()
  })
})

describe("textEditTargetAt", () => {
  test("returns the block id when the point lands on the current single text selection", () => {
    const index = buildIndex([makeTextBlock({ id: "text", layout: { x: 0, y: 0 } })])

    expect(textEditTargetAt(index, { x: 10, y: 10 }, new Set(["text"]))).toBe("text")
  })

  test("returns null when the hit is not a text block", () => {
    const index = buildIndex([makeShapeBlock({ id: "shape", layout: { x: 0, y: 0 } })])

    expect(textEditTargetAt(index, { x: 10, y: 10 }, new Set(["shape"]))).toBeNull()
  })

  test("returns null when the point hits a different block than the current selection", () => {
    const index = buildIndex([
      makeTextBlock({ id: "first", layout: { x: 0, y: 0, width: 96, height: 32 } }),
      makeTextBlock({ id: "second", layout: { x: 0, y: 200, width: 96, height: 32 } })
    ])

    expect(textEditTargetAt(index, { x: 10, y: 210 }, new Set(["first"]))).toBeNull()
  })

  test("returns null for a locked or hidden text block", () => {
    const index = buildIndex([
      makeTextBlock({ id: "locked", layout: { x: 0, y: 0 }, locked: true })
    ])

    expect(textEditTargetAt(index, { x: 10, y: 10 }, new Set(["locked"]))).toBeNull()
  })

  test("returns null when the point misses every block", () => {
    const index = buildIndex([makeTextBlock({ id: "text", layout: { x: 0, y: 0 } })])

    expect(textEditTargetAt(index, { x: 900, y: 900 }, new Set(["text"]))).toBeNull()
  })

  test("returns null when more than one block is selected", () => {
    const index = buildIndex([makeTextBlock({ id: "text", layout: { x: 0, y: 0 } })])

    expect(textEditTargetAt(index, { x: 10, y: 10 }, new Set(["text", "other"]))).toBeNull()
  })
})

describe("reparentTargetAt", () => {
  test("returns the topmost frame under the pointer, skipping the dragged subtree", () => {
    const index = buildIndex([
      makeFrameBlock({ id: "under", layout: { x: 0, y: 0, width: 480, height: 240 } }),
      makeFrameBlock({ id: "over", layout: { x: 100, y: 0, width: 480, height: 240 } })
    ])

    expect(reparentTargetAt(index, { x: 200, y: 100 }, new Set(["dragged"]))).toBe("over")
    expect(reparentTargetAt(index, { x: 200, y: 100 }, new Set(["over"]))).toBe("under")
  })

  test("returns null over empty page and ignores non-frame hits", () => {
    const index = buildIndex([makeShapeBlock({ id: "shape", layout: { x: 0, y: 0 } })])

    expect(reparentTargetAt(index, { x: 10, y: 10 }, new Set())).toBeNull()
    expect(reparentTargetAt(index, { x: 600, y: 600 }, new Set())).toBeNull()
  })

  test("still targets a locked frame, matching the legacy drop behavior", () => {
    const index = buildIndex([
      makeFrameBlock({ id: "locked", layout: { x: 0, y: 0 }, locked: true })
    ])

    expect(reparentTargetAt(index, { x: 100, y: 100 }, new Set(["dragged"]))).toBe("locked")
  })
})

describe("resolveResizeUpdate", () => {
  const largeBounds = { width: 2000, height: 2000 }

  test("resolves a one-member set's reference and member rect together", () => {
    const baseReference = { x: 0, y: 0, width: 200, height: 96 }
    const members: ResizeSetMember[] = [{ id: "a", rect: baseReference, rotation: 0 }]

    const update = resolveResizeUpdate({
      members,
      baseReference,
      baseRotation: 0,
      direction: "se",
      origin: { x: 0, y: 0 },
      point: { x: 40, y: 16 },
      shiftKey: false,
      altKey: false,
      uniformOnly: false,
      clamp: false,
      bounds: largeBounds
    })

    expect(update.reference).toEqual({ x: 0, y: 0, width: 240, height: 112 })
    expect(update.members.get("a")).toEqual({
      rect: { x: 0, y: 0, width: 240, height: 112 },
      rotation: 0
    })
  })

  test("quantizes a one-member set's reference to the grid", () => {
    const baseReference = { x: 0, y: 0, width: 200, height: 96 }
    const members: ResizeSetMember[] = [{ id: "a", rect: baseReference, rotation: 0 }]

    const update = resolveResizeUpdate({
      members,
      baseReference,
      baseRotation: 0,
      direction: "e",
      origin: { x: 0, y: 0 },
      point: { x: 5, y: 0 },
      shiftKey: false,
      altKey: false,
      uniformOnly: false,
      clamp: false,
      bounds: largeBounds
    })

    expect(update.reference.width).toBe(208)
  })

  test("clamps a top-level target's reference into the page bounds", () => {
    const baseReference = { x: 0, y: 0, width: 200, height: 96 }
    const members: ResizeSetMember[] = [{ id: "a", rect: baseReference, rotation: 0 }]
    const bounds = { width: 728, height: 4000 }

    const update = resolveResizeUpdate({
      members,
      baseReference,
      baseRotation: 0,
      direction: "e",
      origin: { x: 0, y: 0 },
      point: { x: 5000, y: 0 },
      shiftKey: false,
      altKey: false,
      uniformOnly: false,
      clamp: true,
      bounds
    })

    expect(update.reference).toEqual({ x: 0, y: 0, width: 728, height: 96 })
    expect(update.limits).toEqual({ right: 728 })
  })

  // IMPORTANT: the commit path must clamp the same pre-clamp sized reference the preview
  // clamped, not re-clamp the already-clamped `reference` - quantize(clamp(x)) != clamp(quantize(x))
  // at an off-grid position, which is the 2px preview/commit mismatch this field prevents.
  test("exposes the pre-clamp sized reference alongside the clamped reference", () => {
    const baseReference = { x: 70, y: 10, width: 160, height: 96 }
    const members: ResizeSetMember[] = [{ id: "a", rect: baseReference, rotation: 0 }]
    const bounds = { width: 728, height: 4000 }

    const update = resolveResizeUpdate({
      members,
      baseReference,
      baseRotation: 0,
      direction: "e",
      origin: { x: 0, y: 0 },
      point: { x: 5000, y: 0 },
      shiftKey: false,
      altKey: false,
      uniformOnly: false,
      clamp: true,
      bounds
    })

    expect(update.reference).toEqual({ x: 70, y: 10, width: 658, height: 96 })
    expect(update.sizedReference).toEqual({ x: 70, y: 10, width: 5160, height: 96 })
  })

  test("keeps an off-grid position while quantizing the size to the grid", () => {
    const baseReference = { x: 70, y: 10, width: 160, height: 96 }
    const members: ResizeSetMember[] = [{ id: "a", rect: baseReference, rotation: 0 }]

    const update = resolveResizeUpdate({
      members,
      baseReference,
      baseRotation: 0,
      direction: "e",
      origin: { x: 0, y: 0 },
      point: { x: 37, y: 0 },
      shiftKey: false,
      altKey: false,
      uniformOnly: false,
      clamp: true,
      bounds: { width: 728, height: 4000 }
    })

    expect(update.reference).toEqual({ x: 70, y: 10, width: 200, height: 96 })
  })

  test("re-anchors a west-handle drag after quantizing so the east edge stays fixed", () => {
    const baseReference = { x: 100, y: 0, width: 160, height: 96 }
    const members: ResizeSetMember[] = [{ id: "a", rect: baseReference, rotation: 0 }]

    const update = resolveResizeUpdate({
      members,
      baseReference,
      baseRotation: 0,
      direction: "w",
      origin: { x: 100, y: 0 },
      point: { x: 63, y: 0 },
      shiftKey: false,
      altKey: false,
      uniformOnly: false,
      clamp: true,
      bounds: { width: 728, height: 4000 }
    })

    expect(update.reference).toEqual({ x: 60, y: 0, width: 200, height: 96 })
  })

  // The nw handle anchors the opposite (bottom-right) corner at baseReference's far edge
  // (96+96, 96+32) = (192, 128). Flooring the near edge at the parent origin must shrink the
  // size by the same delta so that anchor never moves.
  test("floors a frame child's reference at its parent's page origin every frame", () => {
    const baseReference = { x: 96, y: 96, width: 96, height: 32 }
    const members: ResizeSetMember[] = [{ id: "child", rect: baseReference, rotation: 0 }]

    const update = resolveResizeUpdate({
      members,
      baseReference,
      baseRotation: 0,
      direction: "nw",
      origin: { x: 96, y: 96 },
      point: { x: -5000, y: -5000 },
      shiftKey: false,
      altKey: false,
      uniformOnly: false,
      clamp: false,
      bounds: { width: 728, height: 4000 },
      parentRect: { x: 80, y: 80, width: 480, height: 240 }
    })

    expect(update.reference).toEqual({ x: 80, y: 80, width: 112, height: 48 })
  })

  test("forces aspect lock when the set is not uniform-safe, even without Shift", () => {
    const baseReference = { x: 0, y: 0, width: 200, height: 96 }
    const members: ResizeSetMember[] = [{ id: "a", rect: baseReference, rotation: 0 }]

    const update = resolveResizeUpdate({
      members,
      baseReference,
      baseRotation: 0,
      direction: "se",
      origin: { x: 0, y: 0 },
      point: { x: 40, y: 0 },
      shiftKey: false,
      altKey: false,
      uniformOnly: true,
      clamp: false,
      bounds: largeBounds
    })

    expect(update.reference.height).toBeGreaterThan(baseReference.height)
  })

  test("floors the scale so the whole set stops together instead of one member passing the minimum", () => {
    const baseReference = { x: 0, y: 0, width: 400, height: 200 }
    const members: ResizeSetMember[] = [
      { id: "big", rect: { x: 0, y: 0, width: 400, height: 200 }, rotation: 0 },
      { id: "small", rect: { x: 0, y: 0, width: 60, height: 20 }, rotation: 0 }
    ]

    const update = resolveResizeUpdate({
      members,
      baseReference,
      baseRotation: 0,
      direction: "se",
      origin: { x: 0, y: 0 },
      point: { x: -320, y: -160 },
      shiftKey: false,
      altKey: false,
      uniformOnly: false,
      clamp: false,
      bounds: largeBounds
    })

    expect(update.reference).toEqual({ x: 0, y: 0, width: 320, height: 160 })
    expect(update.members.get("small")).toEqual({
      rect: { x: 0, y: 0, width: 48, height: 16 },
      rotation: 0
    })
  })

  test("re-anchors a rotated single block after quantizing so the opposite corner stays visually fixed", () => {
    const baseReference = { x: 200, y: 200, width: 160, height: 40 }
    const members: ResizeSetMember[] = [{ id: "a", rect: baseReference, rotation: 90 }]

    const update = resolveResizeUpdate({
      members,
      baseReference,
      baseRotation: 90,
      direction: "se",
      origin: { x: 0, y: 0 },
      point: { x: 0, y: 40 },
      shiftKey: false,
      altKey: false,
      uniformOnly: false,
      clamp: false,
      bounds: largeBounds
    })

    // The pointer's page-space delta projects into the block's own rotated axes, so a downward
    // drag at 90° grows the local width.
    expect(update.reference.width).toBe(200)
    expect(update.reference.height).toBe(40)

    const before = pageCorner(baseReference, 90, 0, 0)
    const after = pageCorner(update.reference, 90, 0, 0)

    expect(after.x).toBeCloseTo(before.x)
    expect(after.y).toBeCloseTo(before.y)
  })

  test("keeps a rotated top-level target's footprint inside the page bounds", () => {
    const baseReference = { x: 200, y: 100, width: 160, height: 40 }
    const members: ResizeSetMember[] = [{ id: "a", rect: baseReference, rotation: 90 }]
    const bounds = { width: 728, height: 4000 }

    const update = resolveResizeUpdate({
      members,
      baseReference,
      baseRotation: 90,
      direction: "se",
      origin: { x: 0, y: 0 },
      point: { x: 0, y: 240 },
      shiftKey: false,
      altKey: false,
      uniformOnly: false,
      clamp: true,
      bounds
    })

    const aabb = rotatedAabb(update.reference, 90)

    expect(update.reference.width).toBeGreaterThan(baseReference.width)
    expect(aabb.x).toBeGreaterThanOrEqual(0)
    expect(aabb.y).toBeGreaterThanOrEqual(0)
    expect(aabb.x + aabb.width).toBeLessThanOrEqual(bounds.width)
  })
})

describe("collectResizeSet", () => {
  test("uses a rotated sole target's own rect and rotation as the base reference, not its AABB", () => {
    const index = buildIndex([
      makeShapeBlock({ id: "a", layout: { x: 200, y: 200, width: 160, height: 40 }, rotation: 90 })
    ])

    const set = collectResizeSet(index, ["a"])

    expect(set?.baseReference).toEqual({ x: 200, y: 200, width: 160, height: 40 })
    expect(set?.baseRotation).toBe(90)
  })

  test("keeps the axis-aligned union and rotation 0 for a multi-selection", () => {
    const index = buildIndex([
      makeShapeBlock({ id: "a", layout: { x: 0, y: 0, width: 80, height: 80 }, rotation: 45 }),
      makeShapeBlock({ id: "b", layout: { x: 200, y: 200, width: 80, height: 80 } })
    ])

    const set = collectResizeSet(index, ["a", "b"])

    expect(set?.baseRotation).toBe(0)
    expect(set?.baseReference.width).toBeGreaterThan(0)
  })
})
