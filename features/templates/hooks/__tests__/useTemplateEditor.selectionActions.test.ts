// @vitest-environment happy-dom

import { act, renderHook } from "@testing-library/react"

import { describe, expect, test } from "vitest"

import { makeFrameBlock, makeShapeBlock } from "@/tests/factories/blocks"

import { GRID_SIZE, type Block } from "../../schemas"
import { DEFAULT_PAGE_SETTINGS, findBlock } from "../../services"
import { useTemplateEditor } from "../useTemplateEditor"

function renderEditor(blocks: Block[]) {
  return renderHook(() => useTemplateEditor(blocks, "invoice", DEFAULT_PAGE_SETTINGS)).result
}

function twoShapes() {
  return [
    makeShapeBlock({ id: "a", layout: { x: 40, y: 40, width: 160, height: 96 } }),
    makeShapeBlock({ id: "b", layout: { x: 280, y: 160, width: 160, height: 96 } })
  ]
}

describe("useTemplateEditor.copySelection / pasteClipboard", () => {
  test("pastes a fresh clone offset one grid cell from the copied source", () => {
    const result = renderEditor(twoShapes())

    act(() => result.current.setSelection(["a"]))
    act(() => result.current.copySelection())
    act(() => result.current.pasteClipboard())

    expect(result.current.blocks).toHaveLength(3)

    const pasted = result.current.blocks[2]

    expect(pasted?.id).not.toBe("a")
    expect(pasted?.layout).toMatchObject({ x: 40 + GRID_SIZE, y: 40 + GRID_SIZE })
    expect(result.current.selectedIds).toEqual([pasted?.id])
  })

  test("paste-here positions the pasted block at the given anchor point", () => {
    const result = renderEditor(twoShapes())

    act(() => result.current.setSelection(["a"]))
    act(() => result.current.copySelection())
    act(() => result.current.pasteClipboard({ x: 200, y: 200 }))

    const pasted = result.current.blocks[2]

    expect(pasted?.layout).toMatchObject({ x: 200, y: 200 })
  })

  test("is one undo step", () => {
    const result = renderEditor(twoShapes())

    act(() => result.current.setSelection(["a"]))
    act(() => result.current.copySelection())
    act(() => result.current.pasteClipboard())

    expect(result.current.blocks).toHaveLength(3)

    act(() => result.current.undo())

    expect(result.current.blocks).toHaveLength(2)
  })

  // The clipboard buffer is module-level (survives across renderHook instances within the process,
  // matching its real session-persistent design), so this asserts the specific no-clobber behavior
  // deterministically within one test rather than relying on some other test never having copied
  // anything first.
  test("copying an empty selection does not clear a previously copied clipboard", () => {
    const result = renderEditor(twoShapes())

    act(() => result.current.setSelection(["a"]))
    act(() => result.current.copySelection())
    act(() => result.current.setSelection([]))
    act(() => result.current.copySelection())
    act(() => result.current.pasteClipboard())

    expect(result.current.blocks).toHaveLength(3)
  })
})

describe("useTemplateEditor.duplicateSelection", () => {
  test("clones every top-level selected block in one commit", () => {
    const result = renderEditor(twoShapes())

    act(() => result.current.setSelection(["a", "b"]))
    act(() => result.current.duplicateSelection())

    expect(result.current.blocks).toHaveLength(4)
    expect(result.current.selectedIds).toHaveLength(2)
  })

  test("is one undo step", () => {
    const result = renderEditor(twoShapes())

    act(() => result.current.setSelection(["a", "b"]))
    act(() => result.current.duplicateSelection())

    act(() => result.current.undo())

    expect(result.current.blocks).toHaveLength(2)
  })

  test("clones a nested frame child instead of dropping it from a mixed selection", () => {
    const child = makeShapeBlock({ id: "child", layout: { x: 0, y: 0, width: 96, height: 48 } })
    const frame = makeFrameBlock({
      id: "frame",
      layout: { x: 40, y: 40, width: 320, height: 240 },
      children: [child]
    })
    const result = renderEditor([frame, ...twoShapes()])

    act(() => result.current.setSelection(["a", "child"]))
    act(() => result.current.duplicateSelection())

    expect(result.current.blocks).toHaveLength(4)

    const resultFrame = findBlock(result.current.blocks, "frame")?.block
    const frameChildren = resultFrame?.type === "frame" ? resultFrame.content.children : []

    expect(frameChildren).toHaveLength(2)
    expect(result.current.selectedIds).toHaveLength(2)
  })
})

describe("useTemplateEditor.removeSelection", () => {
  test("removes every id in the set as one undo entry", () => {
    const result = renderEditor(twoShapes())

    act(() => result.current.removeSelection(["a", "b"]))

    expect(result.current.blocks).toHaveLength(0)

    act(() => result.current.undo())

    expect(result.current.blocks).toHaveLength(2)
  })

  test("clears removed ids from the selection", () => {
    const result = renderEditor(twoShapes())

    act(() => result.current.setSelection(["a", "b"]))
    act(() => result.current.removeSelection(["a"]))

    expect(result.current.selectedIds).toEqual(["b"])
  })
})

describe("useTemplateEditor z-order selection actions", () => {
  function threeShapes() {
    return [
      makeShapeBlock({ id: "a", layout: { x: 0, y: 0, width: 96, height: 96 } }),
      makeShapeBlock({ id: "b", layout: { x: 100, y: 0, width: 96, height: 96 } }),
      makeShapeBlock({ id: "c", layout: { x: 200, y: 0, width: 96, height: 96 } })
    ]
  }

  test("bringSelectionForward swaps the sole selected block with its next sibling", () => {
    const result = renderEditor(threeShapes())

    act(() => result.current.setSelection(["a"]))
    act(() => result.current.bringSelectionForward())

    expect(result.current.blocks.map((block) => block.id)).toEqual(["b", "a", "c"])
  })

  test("bringSelectionForward is a no-op for a multi-selection", () => {
    const result = renderEditor(threeShapes())

    act(() => result.current.setSelection(["a", "b"]))
    act(() => result.current.bringSelectionForward())

    expect(result.current.blocks.map((block) => block.id)).toEqual(["a", "b", "c"])
  })

  test("sendSelectionBackward swaps the sole selected block with its previous sibling", () => {
    const result = renderEditor(threeShapes())

    act(() => result.current.setSelection(["c"]))
    act(() => result.current.sendSelectionBackward())

    expect(result.current.blocks.map((block) => block.id)).toEqual(["a", "c", "b"])
  })

  test("bringSelectionToFront moves the whole selection to the top, preserving relative order", () => {
    const result = renderEditor(threeShapes())

    act(() => result.current.setSelection(["a", "b"]))
    act(() => result.current.bringSelectionToFront())

    expect(result.current.blocks.map((block) => block.id)).toEqual(["c", "a", "b"])
  })

  test("sendSelectionToBack moves the whole selection to the bottom, preserving relative order", () => {
    const result = renderEditor(threeShapes())

    act(() => result.current.setSelection(["b", "c"]))
    act(() => result.current.sendSelectionToBack())

    expect(result.current.blocks.map((block) => block.id)).toEqual(["b", "c", "a"])
  })

  test("z-order reorders a frame child within its own frame", () => {
    const childA = makeShapeBlock({ id: "childA", layout: { x: 0, y: 0, width: 48, height: 48 } })
    const childB = makeShapeBlock({ id: "childB", layout: { x: 60, y: 0, width: 48, height: 48 } })
    const frame = makeFrameBlock({ id: "frame", children: [childA, childB] })
    const result = renderEditor([frame])

    act(() => result.current.setSelection(["childA"]))
    act(() => result.current.bringSelectionForward())

    const updatedFrame = findBlock(result.current.blocks, "frame")?.block

    expect(
      updatedFrame?.type === "frame" ? updatedFrame.content.children.map((c) => c.id) : []
    ).toEqual(["childB", "childA"])
  })

  test("bringSelectionToFront is a no-op for a mixed-parent selection", () => {
    const child = makeShapeBlock({ id: "child", layout: { x: 0, y: 0, width: 48, height: 48 } })
    const frame = makeFrameBlock({ id: "frame", children: [child] })
    const top = makeShapeBlock({ id: "top", layout: { x: 200, y: 0, width: 96, height: 96 } })
    const result = renderEditor([frame, top])

    act(() => result.current.setSelection(["child", "top"]))
    act(() => result.current.bringSelectionToFront())

    expect(result.current.blocks.map((block) => block.id)).toEqual(["frame", "top"])
  })
})

describe("useTemplateEditor.toggleHiddenSelection / toggleLockedSelection", () => {
  test("hides every selected block when any member is visible", () => {
    const result = renderEditor(twoShapes())

    act(() => result.current.setSelection(["a", "b"]))
    act(() => result.current.toggleHiddenSelection())

    expect(findBlock(result.current.blocks, "a")?.block.hidden).toBe(true)
    expect(findBlock(result.current.blocks, "b")?.block.hidden).toBe(true)
  })

  test("shows every selected block again once all are hidden", () => {
    const result = renderEditor(twoShapes())

    act(() => result.current.setSelection(["a", "b"]))
    act(() => result.current.toggleHiddenSelection())
    act(() => result.current.toggleHiddenSelection())

    expect(findBlock(result.current.blocks, "a")?.block.hidden).toBe(false)
    expect(findBlock(result.current.blocks, "b")?.block.hidden).toBe(false)
  })

  test("is one undo step for the whole selection", () => {
    const result = renderEditor(twoShapes())

    act(() => result.current.setSelection(["a", "b"]))
    act(() => result.current.toggleLockedSelection())

    expect(findBlock(result.current.blocks, "a")?.block.locked).toBe(true)

    act(() => result.current.undo())

    expect(findBlock(result.current.blocks, "a")?.block.locked).toBe(false)
    expect(findBlock(result.current.blocks, "b")?.block.locked).toBe(false)
  })
})

describe("useTemplateEditor.copyStyle / pasteStyle", () => {
  test("replaces every selected member's style sub-object with the copied one", () => {
    const source = { ...makeShapeBlock({ id: "a" }), style: { backgroundColor: "#ff0000" } }
    const target = makeShapeBlock({ id: "b" })
    const result = renderEditor([source, target])

    act(() => result.current.copyStyle("a"))
    act(() => result.current.setSelection(["b"]))
    act(() => result.current.pasteStyle())

    const updated = findBlock(result.current.blocks, "b")?.block

    expect(updated?.type === "group" ? undefined : updated?.style).toEqual({
      backgroundColor: "#ff0000"
    })
  })

  test("leaves geometry untouched", () => {
    const source = { ...makeShapeBlock({ id: "a" }), style: { backgroundColor: "#ff0000" } }
    const target = makeShapeBlock({
      id: "b",
      layout: { x: 50, y: 60, width: 96, height: 96 }
    })
    const result = renderEditor([source, target])

    act(() => result.current.copyStyle("a"))
    act(() => result.current.setSelection(["b"]))
    act(() => result.current.pasteStyle())

    expect(findBlock(result.current.blocks, "b")?.block.layout).toEqual({
      x: 50,
      y: 60,
      width: 96,
      height: 96
    })
  })

  test("is one undo step for a multi-selection", () => {
    const source = { ...makeShapeBlock({ id: "source" }), style: { fontSize: 20 } }
    const result = renderEditor([source, ...twoShapes()])

    act(() => result.current.copyStyle("source"))
    act(() => result.current.setSelection(["a", "b"]))
    act(() => result.current.pasteStyle())

    act(() => result.current.undo())

    expect(findBlock(result.current.blocks, "b")?.block).toEqual(
      expect.not.objectContaining({ style: expect.anything() })
    )
  })
})
