// @vitest-environment happy-dom

import { act, renderHook } from "@testing-library/react"

import { describe, expect, test } from "vitest"

import { type Block } from "../../schemas"
import { addBlock, getContentBounds, DEFAULT_PAGE_SETTINGS } from "../../services"
import { useTemplateEditor } from "../useTemplateEditor"

const bounds = getContentBounds("invoice", DEFAULT_PAGE_SETTINGS)

function makeInitialBlocks(): Block[] {
  const { blocks: one } = addBlock([], "image", bounds)
  const { blocks: two } = addBlock(one, "text", bounds)

  return two
}

describe("useTemplateEditor.setTextContent", () => {
  test("writes the html and coalesces repeated calls into one undo entry", () => {
    const { result } = renderHook(() =>
      useTemplateEditor(makeInitialBlocks(), "invoice", DEFAULT_PAGE_SETTINGS)
    )

    const text = result.current.blocks.find((block) => block.type === "text")
    const originalHtml = text?.type === "text" ? text.content.html : null

    act(() => result.current.setTextContent(text?.id ?? "", "<p>first</p>"))
    act(() => result.current.setTextContent(text?.id ?? "", "<p>second</p>"))

    const after = result.current.blocks.find((block) => block.id === text?.id)

    expect(after?.type === "text" ? after.content.html : null).toBe("<p>second</p>")

    act(() => result.current.undo())

    const undone = result.current.blocks.find((block) => block.id === text?.id)

    expect(undone?.type === "text" ? undone.content.html : null).toBe(originalHtml)
    expect(result.current.canUndo).toBe(false)
  })

  test("does nothing when the target block is not a text block", () => {
    const { result } = renderHook(() =>
      useTemplateEditor(makeInitialBlocks(), "invoice", DEFAULT_PAGE_SETTINGS)
    )

    const image = result.current.blocks.find((block) => block.type === "image")

    act(() => result.current.setTextContent(image?.id ?? "", "<p>ignored</p>"))

    expect(result.current.blocks.find((block) => block.id === image?.id)).toEqual(image)
    expect(result.current.canUndo).toBe(false)
  })

  test("does not push an undo entry when the committed html matches the current content", () => {
    const { result } = renderHook(() =>
      useTemplateEditor(makeInitialBlocks(), "invoice", DEFAULT_PAGE_SETTINGS)
    )

    const text = result.current.blocks.find((block) => block.type === "text")
    const originalHtml = text?.type === "text" ? text.content.html : null

    act(() => result.current.setTextContent(text?.id ?? "", originalHtml ?? ""))

    expect(result.current.canUndo).toBe(false)
  })
})
