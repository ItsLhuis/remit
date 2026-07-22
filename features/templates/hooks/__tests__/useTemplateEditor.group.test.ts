// @vitest-environment happy-dom

import { act, renderHook } from "@testing-library/react"

import { describe, expect, test } from "vitest"

import { makeFrameBlock, makeShapeBlock } from "@/tests/factories/blocks"

import { type Block } from "../../schemas"
import { findBlock, validateLayout, DEFAULT_PAGE_SETTINGS } from "../../services"
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

describe("useTemplateEditor.groupSelection / wrapInFrame", () => {
  test("wraps the selected top-level blocks in a group whose layout is their union", () => {
    const result = renderEditor(twoShapes())

    act(() => result.current.setSelection(["a", "b"]))
    void act(() => result.current.groupSelection())

    expect(result.current.blocks).toHaveLength(1)

    const group = result.current.blocks[0]

    expect(group?.type).toBe("group")
    expect(group?.layout).toEqual({ x: 40, y: 40, width: 400, height: 216 })
    expect(result.current.selectedIds).toEqual([group?.id])
  })

  test("converts children to container-local coordinates relative to the union's top-left", () => {
    const result = renderEditor(twoShapes())

    act(() => result.current.setSelection(["a", "b"]))
    void act(() => result.current.groupSelection())

    const group = result.current.blocks[0]
    const children = group?.type === "group" ? group.content.children : []
    const a = children.find((child) => child.id === "a")
    const b = children.find((child) => child.id === "b")

    expect(a?.layout).toMatchObject({ x: 0, y: 0 })
    expect(b?.layout).toMatchObject({ x: 240, y: 120 })
  })

  test("is one undo step", () => {
    const result = renderEditor(twoShapes())

    act(() => result.current.setSelection(["a", "b"]))
    void act(() => result.current.groupSelection())

    expect(result.current.blocks).toHaveLength(1)

    act(() => result.current.undo())

    expect(result.current.blocks).toHaveLength(2)
    expect(result.current.canUndo).toBe(false)
  })

  test("group-via-selection and frame-wrap produce identical child geometry from an identical selection", () => {
    const groupResult = renderEditor(twoShapes())
    const frameResult = renderEditor(twoShapes())

    act(() => groupResult.current.setSelection(["a", "b"]))
    void act(() => groupResult.current.groupSelection())

    act(() => frameResult.current.setSelection(["a", "b"]))
    void act(() => frameResult.current.wrapInFrame())

    const group = groupResult.current.blocks[0]
    const frame = frameResult.current.blocks[0]

    expect(group?.layout).toEqual(frame?.layout)

    const groupChildren = group?.type === "group" ? group.content.children : []
    const frameChildren = frame?.type === "frame" ? frame.content.children : []

    expect(groupChildren.map((child) => child.layout)).toEqual(
      frameChildren.map((child) => child.layout)
    )
  })

  test("wraps the selection in an unclipped frame", () => {
    const result = renderEditor(twoShapes())

    act(() => result.current.setSelection(["a", "b"]))
    void act(() => result.current.wrapInFrame())

    const frame = result.current.blocks[0]

    expect(frame?.type).toBe("frame")
    expect(frame?.type === "frame" ? frame.content.clip : undefined).toBe(false)
  })

  test("refuses to group a selection that mixes a locked block", () => {
    const result = renderEditor([
      makeShapeBlock({ id: "a", layout: { x: 0, y: 0, width: 160, height: 96 } }),
      makeShapeBlock({ id: "b", layout: { x: 240, y: 0, width: 160, height: 96 }, locked: true })
    ])

    act(() => result.current.setSelection(["a", "b"]))
    void act(() => result.current.groupSelection())

    expect(result.current.blocks).toHaveLength(2)
  })

  test("returns the new group's id so a caller can move focus onto it", () => {
    const result = renderEditor(twoShapes())

    act(() => result.current.setSelection(["a", "b"]))

    let groupId: string | null = null

    act(() => {
      groupId = result.current.groupSelection()
    })

    expect(groupId).toBe(result.current.blocks[0]?.id)
  })

  test("returns null when the selection is refused", () => {
    const result = renderEditor([
      makeShapeBlock({ id: "a", layout: { x: 0, y: 0, width: 160, height: 96 } }),
      makeShapeBlock({ id: "b", layout: { x: 240, y: 0, width: 160, height: 96 }, locked: true })
    ])

    act(() => result.current.setSelection(["a", "b"]))

    let groupId: string | null = "not-yet-null"

    act(() => {
      groupId = result.current.groupSelection()
    })

    expect(groupId).toBeNull()
  })

  test("wrapInFrame returns the new frame's id so a caller can move focus onto it", () => {
    const result = renderEditor(twoShapes())

    act(() => result.current.setSelection(["a", "b"]))

    let frameId: string | null = null

    act(() => {
      frameId = result.current.wrapInFrame()
    })

    expect(frameId).toBe(result.current.blocks[0]?.id)
  })
})

describe("useTemplateEditor.ungroup", () => {
  test("restores absolute coordinates and splices the freed children back in place", () => {
    const result = renderEditor(twoShapes())

    act(() => result.current.setSelection(["a", "b"]))
    void act(() => result.current.groupSelection())

    const groupId = result.current.blocks[0]?.id

    if (!groupId) throw new Error("expected a group block")

    void act(() => result.current.ungroup(groupId))

    expect(result.current.blocks).toHaveLength(2)
    expect(findBlock(result.current.blocks, "a")?.block.layout).toMatchObject({ x: 40, y: 40 })
    expect(findBlock(result.current.blocks, "b")?.block.layout).toMatchObject({ x: 280, y: 160 })
    expect(result.current.selectedIds.sort()).toEqual(["a", "b"])
  })

  test("is a no-op for a block that is not a group", () => {
    const result = renderEditor(twoShapes())

    void act(() => result.current.ungroup("a"))

    expect(result.current.blocks).toHaveLength(2)
  })

  test("returns the freed children's ids so a caller can move focus onto them", () => {
    const result = renderEditor(twoShapes())

    act(() => result.current.setSelection(["a", "b"]))
    void act(() => result.current.groupSelection())

    const groupId = result.current.blocks[0]?.id

    if (!groupId) throw new Error("expected a group block")

    let freedIds: string[] | null = null

    act(() => {
      freedIds = result.current.ungroup(groupId)
    })

    expect(freedIds).toHaveLength(2)
    expect(freedIds).toEqual(expect.arrayContaining(["a", "b"]))
  })

  test("returns null for a block that is not a group", () => {
    const result = renderEditor(twoShapes())

    let freedIds: string[] | null = ["not-yet-null"]

    act(() => {
      freedIds = result.current.ungroup("a")
    })

    expect(freedIds).toBeNull()
  })
})

describe("useTemplateEditor.moveBlocks inside a container", () => {
  function groupedEditor() {
    const result = renderEditor(twoShapes())

    act(() => result.current.setSelection(["a", "b"]))
    void act(() => result.current.groupSelection())

    return result
  }

  test("grows the group up and left when its top-left member is dragged that way", () => {
    const result = groupedEditor()

    act(() => result.current.moveBlocks(["a"], { x: -40, y: -40 }))

    expect(result.current.blocks[0]?.layout).toEqual({ x: 0, y: 0, width: 440, height: 256 })
  })

  test("keeps the other members where they were on the page when one member grows the group", () => {
    const result = groupedEditor()

    act(() => result.current.moveBlocks(["a"], { x: -40, y: -40 }))

    expect(result.current.blockIndex.get("a")?.pageRect).toMatchObject({ x: 0, y: 0 })
    expect(result.current.blockIndex.get("b")?.pageRect).toMatchObject({ x: 280, y: 160 })
  })

  test("clamps a group member to the page instead of the group's own edge", () => {
    const result = groupedEditor()

    act(() => result.current.moveBlocks(["a"], { x: -400, y: -400 }))

    const group = result.current.blocks[0]

    expect(group?.layout.x).toBeGreaterThanOrEqual(0)
    expect(group?.layout.y).toBeGreaterThanOrEqual(0)
    expect(validateLayout(result.current.blocks, DEFAULT_PAGE_SETTINGS, "invoice")).toEqual({
      valid: true
    })
  })

  test("still floors a frame child at the frame's own origin", () => {
    const child = makeShapeBlock({ id: "child", layout: { x: 0, y: 0, width: 96, height: 96 } })
    const frame = makeFrameBlock({
      id: "frame",
      layout: { x: 80, y: 80, width: 320, height: 240 },
      children: [child]
    })
    const result = renderEditor([frame])

    act(() => result.current.moveBlocks(["child"], { x: -40, y: -40 }))

    expect(findBlock(result.current.blocks, "child")?.block.layout).toMatchObject({ x: 0, y: 0 })
    expect(result.current.blocks[0]?.layout).toMatchObject({ x: 80, y: 80 })
  })
})

describe("useTemplateEditor.setConstraints", () => {
  test("sets a child block's constraints in one undo step", () => {
    const child = makeShapeBlock({ id: "child", layout: { x: 0, y: 0, width: 96, height: 96 } })
    const frame = makeFrameBlock({
      id: "frame",
      layout: { x: 40, y: 40, width: 320, height: 240 },
      children: [child]
    })
    const result = renderEditor([frame])

    act(() => result.current.setConstraints("child", { horizontal: "stretch", vertical: "center" }))

    const updatedFrame = findBlock(result.current.blocks, "frame")?.block
    const updatedChild =
      updatedFrame?.type === "frame" ? updatedFrame.content.children[0] : undefined

    expect(updatedChild?.constraints).toEqual({ horizontal: "stretch", vertical: "center" })

    act(() => result.current.undo())

    const revertedFrame = findBlock(result.current.blocks, "frame")?.block
    const revertedChild =
      revertedFrame?.type === "frame" ? revertedFrame.content.children[0] : undefined

    expect(revertedChild?.constraints).toBeUndefined()
  })
})

describe("useTemplateEditor.resizeBlocks (frame constraints)", () => {
  test("reflows a stretch child when its parent frame resizes, ignoring the frame's own scale", () => {
    const child = makeShapeBlock({ id: "child", layout: { x: 0, y: 0, width: 96, height: 48 } })
    const frame = makeFrameBlock({
      id: "frame",
      layout: { x: 40, y: 40, width: 200, height: 96 },
      children: [child]
    })
    const result = renderEditor([frame])

    act(() => result.current.setConstraints("child", { horizontal: "stretch", vertical: "start" }))
    act(() => result.current.resizeBlocks(["frame"], { x: 40, y: 40, width: 320, height: 96 }))

    const resizedFrame = findBlock(result.current.blocks, "frame")?.block
    const resizedChild =
      resizedFrame?.type === "frame" ? resizedFrame.content.children[0] : undefined

    expect(resizedFrame?.layout).toMatchObject({ width: 320 })
    // Stretch absorbs the frame's +120px delta into the child's width instead of scaling it
    // proportionally (96 * 320/200 would be 153.6): this is what distinguishes a frame resize
    // (per-child constraints) from a group/multi-selection resize (proportional scaling).
    expect(resizedChild?.layout).toMatchObject({ x: 0, y: 0, width: 216, height: 48 })
  })

  test("scales every member of a group proportionally when the group resizes", () => {
    const result = renderEditor(twoShapes())

    act(() => result.current.setSelection(["a", "b"]))
    void act(() => result.current.groupSelection())

    const groupId = result.current.blocks[0]?.id
    const groupLayout = result.current.blocks[0]?.layout

    if (!groupId || !groupLayout) throw new Error("expected a group block")

    act(() => result.current.resizeBlocks([groupId], { ...groupLayout, width: 600 }))

    const group = findBlock(result.current.blocks, groupId)?.block
    const children = group?.type === "group" ? group.content.children : []
    const a = children.find((entry) => entry.id === "a")
    const b = children.find((entry) => entry.id === "b")

    expect(group?.layout).toMatchObject({ x: 40, y: 40, width: 600, height: 216 })
    expect(a?.layout).toMatchObject({ x: 0, width: 240 })
    expect(b?.layout).toMatchObject({ x: 360, width: 240 })
  })
})
