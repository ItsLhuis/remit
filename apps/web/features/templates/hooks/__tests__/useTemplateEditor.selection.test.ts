// @vitest-environment happy-dom

import { act, renderHook } from "@testing-library/react"

import { describe, expect, test } from "vitest"

import { addBlock, findBlock, getContentBounds, DEFAULT_PAGE_SETTINGS } from "../../services"
import { useTemplateEditor } from "../useTemplateEditor"

const bounds = getContentBounds("invoice", DEFAULT_PAGE_SETTINGS)

function makeInitialBlocks() {
  const { blocks: one } = addBlock([], "image", bounds)
  const { blocks: two } = addBlock(one, "text", bounds)

  return two
}

describe("useTemplateEditor selection", () => {
  test("setSelection replaces the whole selection", () => {
    const { result } = renderHook(() =>
      useTemplateEditor(makeInitialBlocks(), "invoice", DEFAULT_PAGE_SETTINGS)
    )

    const ids = result.current.blocks.map((block) => block.id)

    act(() => result.current.setSelection(ids))

    expect(result.current.selectedIds).toEqual(ids)
    expect(result.current.selectedBlockId).toBeNull()
  })

  test("toggleSelection adds and removes one id without touching the rest", () => {
    const { result } = renderHook(() =>
      useTemplateEditor(makeInitialBlocks(), "invoice", DEFAULT_PAGE_SETTINGS)
    )

    const [firstId, secondId] = result.current.blocks.map((block) => block.id)

    act(() => result.current.toggleSelection(firstId ?? ""))
    act(() => result.current.toggleSelection(secondId ?? ""))

    expect(result.current.selectedIds).toEqual([firstId, secondId])

    act(() => result.current.toggleSelection(firstId ?? ""))

    expect(result.current.selectedIds).toEqual([secondId])
  })
})

describe("useTemplateEditor.renameBlock", () => {
  test("sets a trimmed custom name", () => {
    const { result } = renderHook(() =>
      useTemplateEditor(makeInitialBlocks(), "invoice", DEFAULT_PAGE_SETTINGS)
    )

    const id = result.current.blocks[0]?.id ?? ""

    act(() => result.current.renameBlock(id, "  Hero image  "))

    expect(findBlock(result.current.blocks, id)?.block.name).toBe("Hero image")
  })

  test("clears the custom name when renamed to an empty string", () => {
    const { result } = renderHook(() =>
      useTemplateEditor(makeInitialBlocks(), "invoice", DEFAULT_PAGE_SETTINGS)
    )

    const id = result.current.blocks[0]?.id ?? ""

    act(() => result.current.renameBlock(id, "Hero image"))
    act(() => result.current.renameBlock(id, "   "))

    expect(findBlock(result.current.blocks, id)?.block.name).toBeUndefined()
  })
})

describe("useTemplateEditor.reorderSibling", () => {
  test("moves a top-level block to a new z-order index", () => {
    const { result } = renderHook(() =>
      useTemplateEditor(makeInitialBlocks(), "invoice", DEFAULT_PAGE_SETTINGS)
    )

    const [firstId] = result.current.blocks.map((block) => block.id)

    act(() => result.current.reorderSibling(firstId ?? "", 1))

    expect(result.current.blocks.map((block) => block.id)[1]).toBe(firstId)
  })

  test("moves a frame child among its siblings", () => {
    const { result } = renderHook(() =>
      useTemplateEditor(addBlock([], "frame", bounds).blocks, "invoice", DEFAULT_PAGE_SETTINGS)
    )

    const frameId = result.current.blocks[0]?.id ?? ""

    act(() => result.current.addFrameChild(frameId, "text"))
    act(() => result.current.addFrameChild(frameId, "image"))

    const frame = findBlock(result.current.blocks, frameId)?.block

    if (frame?.type !== "frame") throw new Error("expected a frame")

    const [textId] = frame.content.children.map((child) => child.id)

    act(() => result.current.reorderSibling(textId ?? "", 1))

    const reordered = findBlock(result.current.blocks, frameId)?.block

    if (reordered?.type !== "frame") throw new Error("expected a frame")

    expect(reordered.content.children[1]?.id).toBe(textId)
  })
})

describe("useTemplateEditor.reparentBlock (multi-id)", () => {
  test("reparents several selected blocks into a frame and selects them", () => {
    const { result } = renderHook(() =>
      useTemplateEditor(addBlock([], "frame", bounds).blocks, "invoice", DEFAULT_PAGE_SETTINGS)
    )

    const frameId = result.current.blocks[0]?.id ?? ""

    act(() => result.current.addBlock("text"))
    act(() => result.current.addBlock("image"))

    const looseIds = result.current.blocks
      .filter((block) => block.id !== frameId)
      .map((block) => block.id)

    act(() => {
      const reparented = result.current.reparentBlock(looseIds, frameId)

      expect(reparented).toBe(true)
    })

    const frame = findBlock(result.current.blocks, frameId)?.block

    if (frame?.type !== "frame") throw new Error("expected a frame")

    expect(frame.content.children.map((child) => child.id)).toEqual(looseIds)
    expect(result.current.selectedIds).toEqual(looseIds)
  })

  test("returns false and leaves the tree untouched when a dragged block is locked", () => {
    const { result } = renderHook(() =>
      useTemplateEditor(addBlock([], "frame", bounds).blocks, "invoice", DEFAULT_PAGE_SETTINGS)
    )

    const frameId = result.current.blocks[0]?.id ?? ""

    act(() => result.current.addBlock("text"))

    const textId = result.current.blocks.find((block) => block.id !== frameId)?.id ?? ""

    act(() => result.current.toggleLocked(textId))

    act(() => {
      const reparented = result.current.reparentBlock([textId], frameId)

      expect(reparented).toBe(false)
    })

    const frame = findBlock(result.current.blocks, frameId)?.block

    if (frame?.type !== "frame") throw new Error("expected a frame")

    expect(frame.content.children).toHaveLength(0)
  })
})
