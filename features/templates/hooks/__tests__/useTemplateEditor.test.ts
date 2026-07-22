// @vitest-environment happy-dom

import { act, renderHook } from "@testing-library/react"

import { describe, expect, test } from "vitest"

import { resolveResizeUpdate } from "../../components/TemplateEditorPage/engine/gestures"
import { type Block } from "../../schemas"
import {
  addBlock,
  findBlock,
  getContentBounds,
  overlaps,
  DEFAULT_PAGE_SETTINGS
} from "../../services"
import { useTemplateEditor } from "../useTemplateEditor"

const bounds = getContentBounds("invoice", DEFAULT_PAGE_SETTINGS)

function makeInitialBlocks(): Block[] {
  const { blocks: one } = addBlock([], "image", bounds)
  const { blocks: two } = addBlock(one, "text", bounds)

  return two
}

function expectNoOverlap(blocks: readonly Block[]) {
  for (const first of blocks) {
    for (const second of blocks) {
      if (first.id === second.id) continue

      expect(overlaps(first.layout, second.layout)).toBe(false)
    }
  }
}

describe("useTemplateEditor canvas operations", () => {
  test("adds a block below the lowest block and selects it", () => {
    const { result } = renderHook(() =>
      useTemplateEditor(makeInitialBlocks(), "invoice", DEFAULT_PAGE_SETTINGS)
    )

    act(() => result.current.addBlock("shape"))

    expect(result.current.selectedBlock?.type).toBe("shape")
    expectNoOverlap(result.current.blocks)
  })

  test("removes a block and clears the selection when it was selected", () => {
    const { result } = renderHook(() =>
      useTemplateEditor(makeInitialBlocks(), "invoice", DEFAULT_PAGE_SETTINGS)
    )

    const textId = result.current.blocks.find((block) => block.type === "text")?.id ?? ""

    act(() => result.current.selectBlock(textId))
    act(() => result.current.removeBlock(textId))

    expect(result.current.blocks.map((block) => block.type)).toEqual(["image"])
    expect(result.current.selectedBlockId).toBeNull()
  })

  test("moving a block onto a neighbour overlaps it without displacing", () => {
    const { result } = renderHook(() =>
      useTemplateEditor(makeInitialBlocks(), "invoice", DEFAULT_PAGE_SETTINGS)
    )

    const text = result.current.blocks.find((block) => block.type === "text")
    const image = result.current.blocks.find((block) => block.type === "image")
    const imageYBefore = image?.layout.y ?? -1

    act(() => result.current.moveBlockTo(text?.id ?? "", 0, 0))

    const imageAfter = result.current.blocks.find((block) => block.id === image?.id)
    const textAfter = result.current.blocks.find((block) => block.id === text?.id)

    expect(textAfter?.layout.y).toBe(0)
    expect(imageAfter?.layout.y).toBe(imageYBefore)
  })

  test("a move can never leave the page content box", () => {
    const { result } = renderHook(() =>
      useTemplateEditor(makeInitialBlocks(), "invoice", DEFAULT_PAGE_SETTINGS)
    )

    const text = result.current.blocks.find((block) => block.type === "text")

    act(() => result.current.moveBlockTo(text?.id ?? "", 5000, -50))

    const after = result.current.blocks.find((block) => block.id === text?.id)

    expect(after).toBeDefined()

    if (!after) return

    expect(after.layout.x + after.layout.width).toBeLessThanOrEqual(bounds.width)
    expect(after.layout.y).toBeGreaterThanOrEqual(0)
  })

  test("a move persists an off-grid position (Alt drop) rather than snapping to the grid", () => {
    const { result } = renderHook(() =>
      useTemplateEditor(makeInitialBlocks(), "invoice", DEFAULT_PAGE_SETTINGS)
    )

    const text = result.current.blocks.find((block) => block.type === "text")

    act(() => result.current.moveBlockTo(text?.id ?? "", 70, 114))

    const after = result.current.blocks.find((block) => block.id === text?.id)

    expect(after?.layout.x).toBe(70)
    expect(after?.layout.y).toBe(114)
  })

  test("keyboard nudges move one grid cell and coalesce into one undo step", () => {
    const { result } = renderHook(() =>
      useTemplateEditor(makeInitialBlocks(), "invoice", DEFAULT_PAGE_SETTINGS)
    )

    const text = result.current.blocks.find((block) => block.type === "text")
    const startY = text?.layout.y ?? 0

    act(() => result.current.moveBlockBy(text?.id ?? "", 0, 1))
    act(() => result.current.moveBlockBy(text?.id ?? "", 0, 1))

    const after = result.current.blocks.find((block) => block.id === text?.id)

    expect(after?.layout.y).toBe(startY + 16)

    act(() => result.current.undo())

    const undone = result.current.blocks.find((block) => block.id === text?.id)

    expect(undone?.layout.y).toBe(startY)
  })

  test("resize grows past a neighbour because overlap is legal, clamping only at the page", () => {
    const { result } = renderHook(() =>
      useTemplateEditor(makeInitialBlocks(), "invoice", DEFAULT_PAGE_SETTINGS)
    )

    const image = result.current.blocks.find((block) => block.type === "image")
    const text = result.current.blocks.find((block) => block.type === "text")

    // Put the text beside the image, then grow the image through it toward the page edge.
    act(() => result.current.moveBlockTo(text?.id ?? "", 400, 0))
    act(() =>
      result.current.resizeBlockTo(
        image?.id ?? "",
        { ...(image?.layout ?? { x: 0, y: 0, width: 160, height: 160 }), width: 720 },
        { horizontal: "e" }
      )
    )

    const imageAfter = result.current.blocks.find((block) => block.id === image?.id)

    expect(imageAfter?.layout.width).toBe(720)
  })

  test("resize never crosses the page content bound", () => {
    const { result } = renderHook(() =>
      useTemplateEditor(makeInitialBlocks(), "invoice", DEFAULT_PAGE_SETTINGS)
    )

    const image = result.current.blocks.find((block) => block.type === "image")

    act(() =>
      result.current.resizeBlockTo(
        image?.id ?? "",
        { ...(image?.layout ?? { x: 0, y: 0, width: 160, height: 160 }), width: 5000 },
        { horizontal: "e" }
      )
    )

    const after = result.current.blocks.find((block) => block.id === image?.id)

    expect(after).toBeDefined()

    if (!after) return

    expect(after.layout.x + after.layout.width).toBeLessThanOrEqual(bounds.width)
  })

  test("a locked block ignores moves and resizes", () => {
    const { result } = renderHook(() =>
      useTemplateEditor(makeInitialBlocks(), "invoice", DEFAULT_PAGE_SETTINGS)
    )

    const text = result.current.blocks.find((block) => block.type === "text")

    act(() => result.current.toggleLocked(text?.id ?? ""))
    act(() => result.current.moveBlockTo(text?.id ?? "", 320, 320))

    const after = result.current.blocks.find((block) => block.id === text?.id)

    expect(after?.layout).toEqual(text?.layout)
  })

  test("a text block resizes on both axes", () => {
    const { result } = renderHook(() => useTemplateEditor([], "invoice", DEFAULT_PAGE_SETTINGS))

    act(() => result.current.addBlock("text"))

    const text = result.current.blocks[0]

    act(() =>
      result.current.resizeBlockTo(
        text?.id ?? "",
        { ...(text?.layout ?? { x: 0, y: 0, width: 240, height: 32 }), width: 320, height: 200 },
        { horizontal: "e", vertical: "s" }
      )
    )

    const after = result.current.blocks[0]

    expect(after?.layout.width).toBe(320)
    expect(after?.layout.height).toBe(200)
  })
})

describe("useTemplateEditor.moveBlocks", () => {
  test("moves the set by a page-space delta in one undo entry", () => {
    const { result } = renderHook(() =>
      useTemplateEditor(makeInitialBlocks(), "invoice", DEFAULT_PAGE_SETTINGS)
    )

    const text = result.current.blocks.find((block) => block.type === "text")
    const start = text?.layout ?? { x: 0, y: 0, width: 0, height: 0 }

    act(() => result.current.moveBlocks([text?.id ?? ""], { x: 96, y: 64 }))

    const after = result.current.blocks.find((block) => block.id === text?.id)

    expect(after?.layout.x).toBe(start.x + 96)
    expect(after?.layout.y).toBe(start.y + 64)

    act(() => result.current.undo())

    const undone = result.current.blocks.find((block) => block.id === text?.id)

    expect(undone?.layout).toEqual(start)
  })

  test("clamps top-level members into the content box", () => {
    const { result } = renderHook(() =>
      useTemplateEditor(makeInitialBlocks(), "invoice", DEFAULT_PAGE_SETTINGS)
    )

    const text = result.current.blocks.find((block) => block.type === "text")

    act(() => result.current.moveBlocks([text?.id ?? ""], { x: 5000, y: -5000 }))

    const after = result.current.blocks.find((block) => block.id === text?.id)

    expect(after).toBeDefined()

    if (!after) return

    expect(after.layout.x + after.layout.width).toBeLessThanOrEqual(bounds.width)
    expect(after.layout.y).toBe(0)
  })

  test("moves a frame child in page space, floored at the frame content origin", () => {
    const { result } = renderHook(() => useTemplateEditor([], "invoice", DEFAULT_PAGE_SETTINGS))

    act(() => result.current.addBlock("frame"))

    const frameId = result.current.blocks[0]?.id ?? ""

    act(() => result.current.addFrameChild(frameId, "text"))

    const childId = result.current.selectedBlockId ?? ""
    const childBefore = findBlock(result.current.blocks, childId)?.block

    act(() => result.current.moveBlocks([childId], { x: 16, y: -5000 }))

    const childAfter = findBlock(result.current.blocks, childId)?.block

    expect(childAfter?.layout.x).toBe((childBefore?.layout.x ?? 0) + 16)
    expect(childAfter?.layout.y).toBe(0)
  })

  test("ignores locked members entirely", () => {
    const { result } = renderHook(() =>
      useTemplateEditor(makeInitialBlocks(), "invoice", DEFAULT_PAGE_SETTINGS)
    )

    const text = result.current.blocks.find((block) => block.type === "text")

    act(() => result.current.toggleLocked(text?.id ?? ""))

    const historyBefore = result.current.canUndo

    act(() => result.current.moveBlocks([text?.id ?? ""], { x: 16, y: 16 }))

    const after = result.current.blocks.find((block) => block.id === text?.id)

    expect(after?.layout).toEqual(text?.layout)
    expect(result.current.canUndo).toBe(historyBefore)
  })
})

describe("useTemplateEditor.resizeBlocks", () => {
  test("commits the reference rect for a one-member set in one undo entry", () => {
    const { result } = renderHook(() =>
      useTemplateEditor(makeInitialBlocks(), "invoice", DEFAULT_PAGE_SETTINGS)
    )

    const text = result.current.blocks.find((block) => block.type === "text")
    const start = text?.layout ?? { x: 0, y: 0, width: 0, height: 0 }

    act(() => result.current.resizeBlocks([text?.id ?? ""], { ...start, width: 320, height: 200 }))

    const after = result.current.blocks.find((block) => block.id === text?.id)

    expect(after?.layout).toEqual({ ...start, width: 320, height: 200 })

    act(() => result.current.undo())

    const undone = result.current.blocks.find((block) => block.id === text?.id)

    expect(undone?.layout).toEqual(start)
  })

  test("shrink-clamps at the page bound without moving the anchored edge", () => {
    const { result } = renderHook(() =>
      useTemplateEditor(makeInitialBlocks(), "invoice", DEFAULT_PAGE_SETTINGS)
    )

    const text = result.current.blocks.find((block) => block.type === "text")

    act(() => result.current.moveBlockTo(text?.id ?? "", 400, 0))

    const moved = result.current.blocks.find((block) => block.id === text?.id)

    act(() =>
      result.current.resizeBlocks([text?.id ?? ""], {
        ...(moved?.layout ?? { x: 400, y: 0, width: 160, height: 96 }),
        width: 5000
      })
    )

    const after = result.current.blocks.find((block) => block.id === text?.id)

    expect(after?.layout.x).toBe(400)
    expect(after?.layout.width).toBe(bounds.width - 400)
  })

  test("resizes a frame child past its frame's box, floored only at the frame origin", () => {
    const { result } = renderHook(() => useTemplateEditor([], "invoice", DEFAULT_PAGE_SETTINGS))

    act(() => result.current.addBlock("frame"))

    const frameId = result.current.blocks[0]?.id ?? ""
    const frameRect = result.current.blocks[0]?.layout ?? { x: 0, y: 0, width: 480, height: 240 }

    act(() => result.current.addFrameChild(frameId, "text"))

    const childId = result.current.selectedBlockId ?? ""
    const child = findBlock(result.current.blocks, childId)?.block

    act(() =>
      result.current.resizeBlocks([childId], {
        x: frameRect.x + (child?.layout.x ?? 0),
        y: frameRect.y + (child?.layout.y ?? 0),
        width: frameRect.width + 320,
        height: 96
      })
    )

    const after = findBlock(result.current.blocks, childId)?.block

    expect(after?.layout.width).toBe(frameRect.width + 320)
  })

  test("floors the committed size at the block minimum", () => {
    const { result } = renderHook(() =>
      useTemplateEditor(makeInitialBlocks(), "invoice", DEFAULT_PAGE_SETTINGS)
    )

    const text = result.current.blocks.find((block) => block.type === "text")

    act(() =>
      result.current.resizeBlocks([text?.id ?? ""], {
        ...(text?.layout ?? { x: 0, y: 0, width: 160, height: 96 }),
        width: 4,
        height: 4
      })
    )

    const after = result.current.blocks.find((block) => block.id === text?.id)

    expect(after?.layout.width).toBe(48)
    expect(after?.layout.height).toBe(16)
  })

  // IMPORTANT: the engine commits resolveResizeUpdate's pre-clamp sizedReference (not the
  // already-clamped reference), so resizeBlocks' own quantize->clamp reproduces the preview's
  // clamped reference bit-for-bit instead of re-quantizing an already-clamped, off-grid width.
  test("commits the exact preview rect for an off-grid block resized into the page bound", () => {
    const offGridBlocks = makeInitialBlocks().map(
      (block): Block =>
        block.type === "text"
          ? { ...block, layout: { x: 70, y: 10, width: 160, height: 96 } }
          : block
    )

    const { result } = renderHook(() =>
      useTemplateEditor(offGridBlocks, "invoice", DEFAULT_PAGE_SETTINGS)
    )

    const text = result.current.blocks.find((block) => block.type === "text")
    const baseReference = text?.layout ?? { x: 0, y: 0, width: 0, height: 0 }

    const preview = resolveResizeUpdate({
      members: [{ id: text?.id ?? "", rect: baseReference, rotation: 0 }],
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

    act(() => result.current.resizeBlocks([text?.id ?? ""], preview.sizedReference))

    const after = result.current.blocks.find((block) => block.id === text?.id)

    expect(after?.layout).toEqual(preview.reference)
  })

  // Mirrors gestures.test.ts's "floors a frame child's reference" test on the commit path: the nw
  // handle anchors the far (bottom-right) corner, so flooring the near edge at the parent origin
  // must shrink the size by the same delta rather than leaving the far edge to drift.
  test("floors a frame child's committed rect at the parent origin without moving the far edge", () => {
    const { result } = renderHook(() => useTemplateEditor([], "invoice", DEFAULT_PAGE_SETTINGS))

    act(() => result.current.addBlock("frame"))

    const frameId = result.current.blocks[0]?.id ?? ""
    const frameRect = result.current.blocks[0]?.layout ?? { x: 0, y: 0, width: 480, height: 240 }

    act(() => result.current.addFrameChild(frameId, "text"))

    const childId = result.current.selectedBlockId ?? ""
    const childBefore = findBlock(result.current.blocks, childId)?.block
    const layoutBefore = childBefore?.layout ?? { x: 0, y: 0, width: 160, height: 32 }

    const farRight = frameRect.x + layoutBefore.x + layoutBefore.width
    const farBottom = frameRect.y + layoutBefore.y + layoutBefore.height

    act(() =>
      result.current.resizeBlocks([childId], {
        x: frameRect.x - 1000,
        y: frameRect.y - 1000,
        width: farRight - (frameRect.x - 1000),
        height: farBottom - (frameRect.y - 1000)
      })
    )

    const after = findBlock(result.current.blocks, childId)?.block

    expect((after?.layout.x ?? 0) + (after?.layout.width ?? 0)).toBe(farRight - frameRect.x)
    expect((after?.layout.y ?? 0) + (after?.layout.height ?? 0)).toBe(farBottom - frameRect.y)
  })
})

describe("useTemplateEditor frame operations", () => {
  test("adds a child to a frame and selects it", () => {
    const { result } = renderHook(() => useTemplateEditor([], "invoice", DEFAULT_PAGE_SETTINGS))

    act(() => result.current.addBlock("frame"))

    const frameId = result.current.blocks[0]?.id ?? ""

    act(() => result.current.addFrameChild(frameId, "image"))

    const frame = result.current.blocks[0]

    if (frame?.type !== "frame") throw new Error("expected a frame block")

    expect(frame.content.children).toHaveLength(1)
    expect(result.current.selectedBlock?.type).toBe("image")
    expect(result.current.selectedParent?.id).toBe(frameId)
  })

  test("reorders and removes frame children by id", () => {
    const { result } = renderHook(() => useTemplateEditor([], "invoice", DEFAULT_PAGE_SETTINGS))

    act(() => result.current.addBlock("frame"))

    const frameId = result.current.blocks[0]?.id ?? ""

    act(() => result.current.addFrameChild(frameId, "image"))
    act(() => result.current.addFrameChild(frameId, "text"))

    const frame = result.current.blocks[0]

    if (frame?.type !== "frame") throw new Error("expected a frame block")

    const textChildId = frame.content.children[1]?.id ?? ""

    act(() => result.current.moveFrameChild(textChildId, -1))

    const reordered = result.current.blocks[0]

    if (reordered?.type !== "frame") throw new Error("expected a frame block")

    expect(reordered.content.children[0]?.id).toBe(textChildId)

    act(() => result.current.removeBlock(textChildId))

    const afterRemoval = result.current.blocks[0]

    if (afterRemoval?.type !== "frame") throw new Error("expected a frame block")

    expect(afterRemoval.content.children).toHaveLength(1)
  })
})

describe("useTemplateEditor page settings", () => {
  test("shrinking the content box reflows blocks back inside it", () => {
    const { result } = renderHook(() =>
      useTemplateEditor(makeInitialBlocks(), "invoice", DEFAULT_PAGE_SETTINGS)
    )

    const text = result.current.blocks.find((block) => block.type === "text")

    act(() =>
      result.current.moveBlockTo(text?.id ?? "", bounds.width - (text?.layout.width ?? 0), 400)
    )
    act(() =>
      result.current.setPageSettings({
        ...DEFAULT_PAGE_SETTINGS,
        margins: { top: 32, right: 96, bottom: 32, left: 96 }
      })
    )

    const narrow = getContentBounds("invoice", {
      ...DEFAULT_PAGE_SETTINGS,
      margins: { top: 32, right: 96, bottom: 32, left: 96 }
    })

    for (const block of result.current.blocks) {
      expect(block.layout.x + block.layout.width).toBeLessThanOrEqual(narrow.width)
    }

    expectNoOverlap(result.current.blocks)
  })
})

describe("useTemplateEditor history and dirtiness", () => {
  test("undo and redo walk the document history", () => {
    const { result } = renderHook(() => useTemplateEditor([], "invoice", DEFAULT_PAGE_SETTINGS))

    act(() => result.current.addBlock("text"))

    expect(result.current.blocks).toHaveLength(1)

    act(() => result.current.undo())

    expect(result.current.blocks).toHaveLength(0)

    act(() => result.current.redo())

    expect(result.current.blocks).toHaveLength(1)
  })

  test("markSaved clears dirtiness until the next edit", () => {
    const { result } = renderHook(() => useTemplateEditor([], "invoice", DEFAULT_PAGE_SETTINGS))

    act(() => result.current.addBlock("text"))

    expect(result.current.isDirty).toBe(true)

    act(() => result.current.markSaved())

    expect(result.current.isDirty).toBe(false)
  })

  test("zoom steps through the preset levels and clamps at the ends", () => {
    const { result } = renderHook(() => useTemplateEditor([], "invoice", DEFAULT_PAGE_SETTINGS))

    act(() => result.current.zoomIn())

    expect(result.current.zoom).toBe(1.25)

    act(() => result.current.setZoom(10))

    expect(result.current.zoom).toBe(2)
  })
})

describe("useTemplateEditor.syncBlockMinHeight", () => {
  test("raises a text block to its content floor without creating an undo step", () => {
    const { result } = renderHook(() =>
      useTemplateEditor(addBlock([], "text", bounds).blocks, "invoice", DEFAULT_PAGE_SETTINGS)
    )

    const textId = result.current.blocks[0]?.id ?? ""
    const startHeight = result.current.blocks[0]?.layout.height ?? 0

    act(() => result.current.syncBlockMinHeight(textId, startHeight + 8))

    expect(result.current.blocks[0]?.layout.height).toBe(startHeight + 8)
    expect(result.current.canUndo).toBe(false)
    expect(result.current.isDirty).toBe(false)
  })

  test("keeps real edits dirty and leaves the height sync out of the undo history", () => {
    const { result } = renderHook(() =>
      useTemplateEditor(addBlock([], "text", bounds).blocks, "invoice", DEFAULT_PAGE_SETTINGS)
    )

    const original = result.current.blocks[0]

    if (original?.type !== "text") throw new Error("expected a text block")

    act(() => result.current.replaceBlock({ ...original, content: { html: "edited" } }))

    const grownHeight = (result.current.blocks[0]?.layout.height ?? 0) + 8

    act(() => result.current.syncBlockMinHeight(original.id, grownHeight))

    expect(result.current.isDirty).toBe(true)

    act(() => result.current.undo())

    expect(result.current.blocks[0]?.content).toEqual(original.content)
  })

  test("grows text height without displacing a neighbour below", () => {
    const { result } = renderHook(() =>
      useTemplateEditor(
        addBlock(addBlock([], "text", bounds).blocks, "image", bounds).blocks,
        "invoice",
        DEFAULT_PAGE_SETTINGS
      )
    )

    const text = result.current.blocks.find((block) => block.type === "text")
    const image = result.current.blocks.find((block) => block.type === "image")
    const imageYBefore = image?.layout.y ?? 0

    act(() =>
      result.current.syncBlockMinHeight(
        text?.id ?? "",
        (text?.layout.height ?? 0) + imageYBefore + 16
      )
    )

    const imageAfter = result.current.blocks.find((block) => block.id === image?.id)

    expect(imageAfter?.layout.y).toBe(imageYBefore)
  })

  test("never shrinks a text block below the height the user set", () => {
    const { result } = renderHook(() =>
      useTemplateEditor(addBlock([], "text", bounds).blocks, "invoice", DEFAULT_PAGE_SETTINGS)
    )

    const before = result.current.blocks[0]
    const startHeight = before?.layout.height ?? 0

    act(() => result.current.syncBlockMinHeight(before?.id ?? "", startHeight))
    act(() => result.current.syncBlockMinHeight(before?.id ?? "", startHeight - 8))

    expect(result.current.blocks[0]).toBe(before)
    expect(result.current.isDirty).toBe(false)
    expect(result.current.canUndo).toBe(false)
  })
})

describe("useTemplateEditor nested frames", () => {
  test("selects, edits, and removes a frame child nested one level deep", () => {
    const { result } = renderHook(() =>
      useTemplateEditor(addBlock([], "frame", bounds).blocks, "invoice", DEFAULT_PAGE_SETTINGS)
    )

    const outerId = result.current.blocks[0]?.id ?? ""

    act(() => result.current.addFrameChild(outerId, "frame"))

    const innerId = result.current.selectedBlockId ?? ""

    act(() => result.current.addFrameChild(innerId, "text"))

    const textId = result.current.selectedBlockId ?? ""

    act(() => result.current.selectBlock(textId))

    expect(result.current.selectedBlock?.id).toBe(textId)
    expect(result.current.selectedParent?.id).toBe(innerId)

    const selected = result.current.selectedBlock

    if (selected?.type !== "text") throw new Error("expected a nested text child")

    act(() => result.current.replaceBlock({ ...selected, content: { html: "deep" } }))

    const edited = findBlock(result.current.blocks, textId)?.block

    if (edited?.type !== "text") throw new Error("expected a text child")

    expect(edited.content.html).toBe("deep")

    act(() => result.current.removeBlock(textId))

    expect(findBlock(result.current.blocks, textId)).toBeNull()
  })
})
