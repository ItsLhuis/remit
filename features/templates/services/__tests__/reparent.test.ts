import { describe, expect, test } from "vitest"

import { type Block } from "../../schemas"
import { type ContentBounds } from "../canvasLayout"
import { reparentBlock } from "../reparent"

// Generous enough that none of the fixture drops below clamp against it; tests exercising the
// page-content clamp pass their own tight bounds.
const bounds: ContentBounds = { width: 2000, height: 2000 }

function textBlock(id: string, x: number, y: number): Block {
  return {
    id,
    type: "text",
    layout: { x, y, width: 240, height: 32 },
    hidden: false,
    locked: false,
    content: { html: id }
  }
}

function frameBlock(id: string, x: number, y: number, children: Block[]): Block {
  return {
    id,
    type: "frame",
    layout: { x, y, width: 480, height: 240 },
    hidden: false,
    locked: false,
    content: { clip: false, children }
  }
}

function groupBlock(id: string, x: number, y: number, children: Block[]): Block {
  return {
    id,
    type: "group",
    layout: { x, y, width: 480, height: 240 },
    hidden: false,
    locked: false,
    content: { children }
  }
}

describe("reparentBlock", () => {
  test("moves a top-level block into a frame, converting page coords to frame-local", () => {
    const blocks = [frameBlock("f", 80, 80, []), textBlock("t", 120, 120)]

    const result = reparentBlock({
      blocks: blocks,
      draggedIds: ["t"],
      targetFrameId: "f",
      bounds: bounds,
      droppedRects: new Map([["t", { x: 120, y: 120, width: 240, height: 32 }]])
    })

    if (!result) throw new Error("expected a reparent result")

    expect(result.blocks).toHaveLength(1)

    const frame = result.blocks[0]

    if (frame?.type !== "frame") throw new Error("expected the frame to remain")

    expect(frame.content.children).toHaveLength(1)
    expect(frame.content.children[0]?.id).toBe("t")
    expect(frame.content.children[0]?.layout).toMatchObject({ x: 40, y: 40 })
  })

  test("appends the moved block on top of the frame's existing children", () => {
    const blocks = [frameBlock("f", 0, 0, [textBlock("a", 0, 0)]), textBlock("b", 16, 16)]

    const result = reparentBlock({
      blocks: blocks,
      draggedIds: ["b"],
      targetFrameId: "f",
      bounds: bounds,
      droppedRects: new Map([["b", { x: 16, y: 16, width: 240, height: 32 }]])
    })

    if (!result) throw new Error("expected a reparent result")

    const frame = result.blocks[0]

    if (frame?.type !== "frame") throw new Error("expected the frame")

    expect(frame.content.children.map((child) => child.id)).toEqual(["a", "b"])
  })

  test("accepts a frame-local drop exactly at the frame's origin", () => {
    const blocks = [frameBlock("f", 200, 200, []), textBlock("t", 0, 0)]

    const result = reparentBlock({
      blocks: blocks,
      draggedIds: ["t"],
      targetFrameId: "f",
      bounds: bounds,
      droppedRects: new Map([["t", { x: 200, y: 200, width: 240, height: 32 }]])
    })

    if (!result) throw new Error("expected a reparent result")

    const frame = result.blocks[0]

    if (frame?.type !== "frame") throw new Error("expected the frame")

    expect(frame.content.children[0]?.layout).toMatchObject({ x: 0, y: 0 })
  })

  test("refuses a reparent into a frame when the drop would require a negative local coordinate", () => {
    const blocks = [frameBlock("f", 200, 200, []), textBlock("t", 100, 100)]

    const result = reparentBlock({
      blocks: blocks,
      draggedIds: ["t"],
      targetFrameId: "f",
      bounds: bounds,
      droppedRects: new Map([["t", { x: 100, y: 100, width: 240, height: 32 }]])
    })

    expect(result).toBeNull()
  })

  test("refuses the whole reparent when only one of several dragged blocks would go negative", () => {
    const blocks = [
      frameBlock("f", 200, 200, []),
      textBlock("a", 250, 250),
      textBlock("b", 100, 100)
    ]

    const result = reparentBlock({
      blocks: blocks,
      draggedIds: ["a", "b"],
      targetFrameId: "f",
      bounds: bounds,
      droppedRects: new Map([
        ["a", { x: 250, y: 250, width: 240, height: 32 }],
        ["b", { x: 100, y: 100, width: 240, height: 32 }]
      ])
    })

    expect(result).toBeNull()
  })

  test("moves a frame child back to the page, converting to page coordinates", () => {
    const blocks = [frameBlock("f", 80, 80, [textBlock("t", 40, 40)])]

    const result = reparentBlock({
      blocks: blocks,
      draggedIds: ["t"],
      targetFrameId: null,
      bounds: bounds
    })

    if (!result) throw new Error("expected a reparent result")

    expect(result.blocks).toHaveLength(2)

    const moved = result.blocks.find((block) => block.id === "t")

    expect(moved?.layout).toMatchObject({ x: 120, y: 120 })

    const frame = result.blocks.find((block) => block.id === "f")

    if (frame?.type !== "frame") throw new Error("expected the frame")

    expect(frame.content.children).toHaveLength(0)
  })

  test("refuses to drop a frame into its own descendant", () => {
    const blocks = [frameBlock("outer", 0, 0, [frameBlock("inner", 0, 0, [])])]

    const result = reparentBlock({
      blocks: blocks,
      draggedIds: ["outer"],
      targetFrameId: "inner",
      bounds: bounds
    })

    expect(result).toBeNull()
  })

  test("refuses a reparent that would exceed the frame depth bound", () => {
    const nested = frameBlock("b", 0, 0, [frameBlock("d", 0, 0, [])])
    const blocks = [frameBlock("a", 0, 0, []), nested]

    const result = reparentBlock({
      blocks: blocks,
      draggedIds: ["b"],
      targetFrameId: "a",
      bounds: bounds,
      droppedRects: new Map([["b", { x: 0, y: 0, width: 480, height: 240 }]])
    })

    expect(result).toBeNull()
  })

  test("is a no-op when a top-level block is dropped on the page", () => {
    const blocks = [textBlock("t", 40, 40)]

    expect(
      reparentBlock({ blocks: blocks, draggedIds: ["t"], targetFrameId: null, bounds: bounds })
    ).toBeNull()
  })

  test("returns null for an unknown dragged id", () => {
    const blocks = [frameBlock("f", 0, 0, [])]

    expect(
      reparentBlock({
        blocks: blocks,
        draggedIds: ["missing"],
        targetFrameId: "f",
        bounds: bounds,
        droppedRects: new Map([["missing", { x: 0, y: 0, width: 240, height: 32 }]])
      })
    ).toBeNull()
  })

  test("returns null for an empty dragged id list", () => {
    const blocks = [frameBlock("f", 0, 0, [])]

    expect(
      reparentBlock({ blocks: blocks, draggedIds: [], targetFrameId: "f", bounds: bounds })
    ).toBeNull()
  })

  // Dropping a frame child out to the page must clamp into the page content bounds,
  // the same clamp every top-level move enforces, so a reparent-to-page drop can never commit a
  // block outside the content box (save-rejected by validateLayout).
  test("clamps a reparent-to-page drop into the page content bounds", () => {
    const blocks = [frameBlock("f", 80, 80, [textBlock("t", 0, 0)])]
    const tightBounds: ContentBounds = { width: 800, height: 800 }

    const result = reparentBlock({
      blocks: blocks,
      draggedIds: ["t"],
      targetFrameId: null,
      bounds: tightBounds,
      droppedRects: new Map([["t", { x: 5000, y: 5000, width: 240, height: 32 }]])
    })

    if (!result) throw new Error("expected a reparent result")

    const moved = result.blocks.find((block) => block.id === "t")

    expect(moved?.layout).toMatchObject({ x: 560, y: 768 })
  })

  // Grid snapping (or its Alt bypass) is already applied upstream by the per-frame
  // gesture math before the drop; reparentBlock must not re-quantize the position it is given.
  test("does not re-quantize an off-grid drop position", () => {
    const blocks = [frameBlock("f", 80, 80, []), textBlock("t", 0, 0)]

    const result = reparentBlock({
      blocks: blocks,
      draggedIds: ["t"],
      targetFrameId: "f",
      bounds: bounds,
      droppedRects: new Map([["t", { x: 125, y: 133, width: 240, height: 32 }]])
    })

    if (!result) throw new Error("expected a reparent result")

    const frame = result.blocks[0]

    if (frame?.type !== "frame") throw new Error("expected the frame")

    expect(frame.content.children[0]?.layout).toMatchObject({ x: 45, y: 53 })
  })

  test("moves several top-level blocks into the same frame in the given order", () => {
    const blocks = [frameBlock("f", 0, 0, []), textBlock("a", 40, 40), textBlock("b", 60, 60)]

    const result = reparentBlock({
      blocks: blocks,
      draggedIds: ["a", "b"],
      targetFrameId: "f",
      bounds: bounds
    })

    if (!result) throw new Error("expected a reparent result")

    const frame = result.blocks[0]

    if (frame?.type !== "frame") throw new Error("expected the frame")

    expect(frame.content.children.map((child) => child.id)).toEqual(["a", "b"])
    expect(frame.content.children[0]?.layout).toMatchObject({ x: 40, y: 40 })
    expect(frame.content.children[1]?.layout).toMatchObject({ x: 60, y: 60 })
  })

  test("moves blocks from different frames back to the page in one commit", () => {
    const blocks = [
      frameBlock("f1", 0, 0, [textBlock("a", 10, 10)]),
      frameBlock("f2", 200, 200, [textBlock("b", 5, 5)])
    ]

    const result = reparentBlock({
      blocks: blocks,
      draggedIds: ["a", "b"],
      targetFrameId: null,
      bounds: bounds
    })

    if (!result) throw new Error("expected a reparent result")

    const movedA = result.blocks.find((block) => block.id === "a")
    const movedB = result.blocks.find((block) => block.id === "b")

    expect(movedA?.layout).toMatchObject({ x: 10, y: 10 })
    expect(movedB?.layout).toMatchObject({ x: 205, y: 205 })
  })

  test("refuses the whole move when any dragged id is unknown", () => {
    const blocks = [frameBlock("f", 0, 0, []), textBlock("a", 0, 0)]

    expect(
      reparentBlock({
        blocks: blocks,
        draggedIds: ["a", "missing"],
        targetFrameId: "f",
        bounds: bounds
      })
    ).toBeNull()
  })

  test("refuses when the target is a descendant of one of several dragged blocks", () => {
    const blocks = [
      frameBlock("outer", 0, 0, [frameBlock("inner", 0, 0, [])]),
      textBlock("a", 0, 0)
    ]

    expect(
      reparentBlock({
        blocks: blocks,
        draggedIds: ["a", "outer"],
        targetFrameId: "inner",
        bounds: bounds
      })
    ).toBeNull()
  })

  test("is a no-op when every dragged block is already at the target", () => {
    const blocks = [frameBlock("f", 0, 0, [textBlock("a", 0, 0), textBlock("b", 10, 10)])]

    expect(
      reparentBlock({ blocks: blocks, draggedIds: ["a", "b"], targetFrameId: "f", bounds: bounds })
    ).toBeNull()
  })

  // A group is a purely logical container, so a frame nested inside a top-level group counts
  // toward FRAME_MAX_DEPTH exactly like a frame nested inside another frame: the depth gate must
  // walk the group's own containerNestingDepth, not skip it because the top-level block happens to
  // be type "group" rather than "frame".
  test("refuses a reparent that would push a group-of-frames past the depth bound", () => {
    const innerFrame = frameBlock("inner", 0, 0, [])
    const group = groupBlock("group", 0, 0, [innerFrame])
    const dropped = frameBlock("dropped", 0, 0, [])

    const result = reparentBlock({
      blocks: [group, dropped],
      draggedIds: ["dropped"],
      targetFrameId: "inner",
      bounds: bounds,
      droppedRects: new Map([["dropped", { x: 0, y: 0, width: 480, height: 240 }]])
    })

    expect(result).toBeNull()
  })

  test("allows a reparent into a frame nested inside a group when the depth bound still holds", () => {
    const innerFrame = frameBlock("inner", 0, 0, [])
    const group = groupBlock("group", 0, 0, [innerFrame])
    const dropped = textBlock("dropped", 0, 0)

    const result = reparentBlock({
      blocks: [group, dropped],
      draggedIds: ["dropped"],
      targetFrameId: "inner",
      bounds: bounds,
      droppedRects: new Map([["dropped", { x: 0, y: 0, width: 240, height: 32 }]])
    })

    if (!result) throw new Error("expected a reparent result")

    const resultGroup = result.blocks.find((block) => block.id === "group")

    if (resultGroup?.type !== "group") throw new Error("expected the group")

    const resultInner = resultGroup.content.children[0]

    if (resultInner?.type !== "frame") throw new Error("expected the inner frame")

    expect(resultInner.content.children.map((child) => child.id)).toEqual(["dropped"])
  })
})
