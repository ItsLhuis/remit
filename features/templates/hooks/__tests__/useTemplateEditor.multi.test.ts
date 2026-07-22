// @vitest-environment happy-dom

import { act, renderHook } from "@testing-library/react"

import { describe, expect, test } from "vitest"

import { makeFrameBlock, makeShapeBlock } from "@/tests/factories/blocks"

import { type Block, type BlockStyle } from "../../schemas"
import { findBlock, getContentBounds, DEFAULT_PAGE_SETTINGS } from "../../services"
import { useTemplateEditor } from "../useTemplateEditor"

const bounds = getContentBounds("invoice", DEFAULT_PAGE_SETTINGS)

function renderEditor(blocks = defaultBlocks()) {
  return renderHook(() => useTemplateEditor(blocks, "invoice", DEFAULT_PAGE_SETTINGS)).result
}

function defaultBlocks() {
  return [
    makeShapeBlock({ id: "a", layout: { x: 0, y: 0, width: 160, height: 96 } }),
    makeShapeBlock({ id: "b", layout: { x: 240, y: 120, width: 160, height: 96 } })
  ]
}

function styleOf(blocks: readonly Block[], id: string): BlockStyle | undefined {
  const block = findBlock(blocks, id)?.block

  return block && block.type !== "group" ? block.style : undefined
}

describe("useTemplateEditor.moveBlocks (multi)", () => {
  test("moves every member by the same delta in one history entry", () => {
    const result = renderEditor()

    act(() => result.current.moveBlocks(["a", "b"], { x: 40, y: 16 }))

    expect(findBlock(result.current.blocks, "a")?.block.layout).toMatchObject({ x: 40, y: 16 })
    expect(findBlock(result.current.blocks, "b")?.block.layout).toMatchObject({ x: 280, y: 136 })

    act(() => result.current.undo())

    expect(findBlock(result.current.blocks, "a")?.block.layout).toMatchObject({ x: 0, y: 0 })
    expect(result.current.canUndo).toBe(false)
  })

  test("clamps the set's union at the page bounds so members keep exact relative offsets", () => {
    const result = renderEditor()

    act(() => result.current.moveBlocks(["a", "b"], { x: 5000, y: 0 }))

    const a = findBlock(result.current.blocks, "a")?.block.layout
    const b = findBlock(result.current.blocks, "b")?.block.layout

    expect(b && a ? b.x - a.x : null).toBe(240)
    expect(b?.x).toBe(bounds.width - 160)
  })

  test("pushes no history entry when the whole move clamps to a standstill", () => {
    const result = renderEditor()

    act(() => result.current.moveBlocks(["a", "b"], { x: -5000, y: -5000 }))

    expect(findBlock(result.current.blocks, "a")?.block.layout).toMatchObject({ x: 0, y: 0 })
    expect(result.current.canUndo).toBe(false)
  })

  test("skips locked members without blocking the rest", () => {
    const result = renderEditor([
      makeShapeBlock({ id: "a", layout: { x: 0, y: 0, width: 160, height: 96 } }),
      makeShapeBlock({ id: "b", layout: { x: 240, y: 120, width: 160, height: 96 }, locked: true })
    ])

    act(() => result.current.moveBlocks(["a", "b"], { x: 40, y: 0 }))

    expect(findBlock(result.current.blocks, "a")?.block.layout).toMatchObject({ x: 40 })
    expect(findBlock(result.current.blocks, "b")?.block.layout).toMatchObject({ x: 240 })
  })

  // Mirrors gestures.test.ts's resolveMoveUpdate case with the same geometry: the drag preview and
  // this commit path must clamp a mixed top-level + frame-child selection to the exact same
  // position, using only the top-level member's union.
  test("clamps a mixed top-level and frame-child selection using only the top-level member's union, matching the drag preview", () => {
    const child = makeShapeBlock({ id: "child", layout: { x: 100, y: 80, width: 160, height: 96 } })
    const frame = makeFrameBlock({
      id: "frame",
      layout: { x: 400, y: 0, width: 300, height: 240 },
      children: [child]
    })
    const a = makeShapeBlock({ id: "a", layout: { x: 80, y: 80, width: 160, height: 96 } })
    const result = renderEditor([frame, a])

    act(() => result.current.moveBlocks(["a", "child"], { x: 5000, y: 0 }))

    expect(findBlock(result.current.blocks, "a")?.block.layout).toMatchObject({ x: 568, y: 80 })

    const movedFrame = findBlock(result.current.blocks, "frame")?.block
    const movedChild = movedFrame?.type === "frame" ? movedFrame.content.children[0] : undefined

    expect(movedChild?.layout).toMatchObject({ x: 588, y: 80 })
  })

  test("leaves a multi-member frame-child-only selection unclamped by the page", () => {
    const first = makeShapeBlock({ id: "first", layout: { x: 20, y: 20, width: 96, height: 32 } })
    const second = makeShapeBlock({ id: "second", layout: { x: 20, y: 60, width: 96, height: 32 } })
    const frame = makeFrameBlock({
      id: "frame",
      layout: { x: 80, y: 80, width: 480, height: 240 },
      children: [first, second]
    })
    const result = renderEditor([frame])

    act(() => result.current.moveBlocks(["first", "second"], { x: 5000, y: 0 }))

    const movedFrame = findBlock(result.current.blocks, "frame")?.block
    const movedFirst = movedFrame?.type === "frame" ? movedFrame.content.children[0] : undefined
    const movedSecond = movedFrame?.type === "frame" ? movedFrame.content.children[1] : undefined

    expect(movedFirst?.layout.x).toBeGreaterThan(bounds.width)
    expect(movedSecond?.layout.x).toBeGreaterThan(bounds.width)
  })
})

describe("useTemplateEditor.setBlocksStyle", () => {
  test("writes every member's style in one history entry", () => {
    const result = renderEditor()

    act(() =>
      result.current.setBlocksStyle(
        new Map([
          ["a", { borderWidth: 2 }],
          ["b", { borderWidth: 2 }]
        ])
      )
    )

    expect(styleOf(result.current.blocks, "a")).toEqual({ borderWidth: 2 })
    expect(styleOf(result.current.blocks, "b")).toEqual({ borderWidth: 2 })

    act(() => result.current.undo())

    expect(styleOf(result.current.blocks, "a")).toBeUndefined()
    expect(result.current.canUndo).toBe(false)
  })

  test("strips the style field when an edit resolves to undefined", () => {
    const result = renderEditor()

    act(() => result.current.setBlocksStyle(new Map([["a", { borderWidth: 2 }]])))
    act(() => result.current.setBlocksStyle(new Map([["a", undefined]])))

    expect(styleOf(result.current.blocks, "a")).toBeUndefined()
  })

  test("never writes to a locked member", () => {
    const result = renderEditor([
      makeShapeBlock({ id: "a", layout: { x: 0, y: 0 } }),
      makeShapeBlock({ id: "b", layout: { x: 240, y: 120 }, locked: true })
    ])

    act(() =>
      result.current.setBlocksStyle(
        new Map([
          ["a", { borderWidth: 2 }],
          ["b", { borderWidth: 2 }]
        ])
      )
    )

    expect(styleOf(result.current.blocks, "a")).toEqual({ borderWidth: 2 })
    expect(styleOf(result.current.blocks, "b")).toBeUndefined()
  })
})
