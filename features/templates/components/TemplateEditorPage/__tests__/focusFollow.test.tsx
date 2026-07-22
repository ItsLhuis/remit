// @vitest-environment happy-dom

import { act, render } from "@testing-library/react"

import { expect, test, vi } from "vitest"

import { makeShapeBlock } from "@/tests/factories/blocks"

import { type EditorInteraction, type TemplateEditorState } from "../../../hooks"

import { Harness, setupCanvasTest, surfaceFor } from "./canvasHarness"

// Pins the M7 accessibility fix: group/wrap/ungroup replace the selected top-level blocks with a
// newly created (or newly freed) block, unmounting the block that keyboard focus was sitting on.
// Without focus-follow, focus is stranded on document.body. These drive editor.groupSelection /
// wrapInFrame / ungroup and interaction.focusNode exactly as the Mod+G / Mod+Shift+W / Mod+Shift+G
// hotkey handlers in TemplateEditorPage do, over the real canvas render tree.

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {},
    ready: true,
    locales: {}
  })
}))

setupCanvasTest()

function twoShapes() {
  return [
    makeShapeBlock({ id: "a", layout: { x: 0, y: 0, width: 96, height: 96 } }),
    makeShapeBlock({ id: "b", layout: { x: 200, y: 0, width: 96, height: 96 } })
  ]
}

test("groupSelection moves focus onto the new group's surface", () => {
  let editor!: TemplateEditorState
  let interaction!: EditorInteraction

  render(
    <Harness
      blocks={twoShapes()}
      onEditor={(nextEditor) => {
        editor = nextEditor
      }}
      onInteraction={(nextInteraction) => {
        interaction = nextInteraction
      }}
    />
  )

  surfaceFor(0).focus()
  act(() => editor.setSelection(["a", "b"]))

  act(() => {
    const groupId = editor.groupSelection()

    interaction.focusNode(groupId)
  })

  expect(surfaceFor(0)).toHaveFocus()
})

test("wrapInFrame moves focus onto the new frame's surface", () => {
  let editor!: TemplateEditorState
  let interaction!: EditorInteraction

  render(
    <Harness
      blocks={twoShapes()}
      onEditor={(nextEditor) => {
        editor = nextEditor
      }}
      onInteraction={(nextInteraction) => {
        interaction = nextInteraction
      }}
    />
  )

  surfaceFor(0).focus()
  act(() => editor.setSelection(["a", "b"]))

  act(() => {
    const frameId = editor.wrapInFrame()

    interaction.focusNode(frameId)
  })

  expect(surfaceFor(0)).toHaveFocus()
})

test("ungroup moves focus onto the first freed child's surface", () => {
  let editor!: TemplateEditorState
  let interaction!: EditorInteraction

  render(
    <Harness
      blocks={twoShapes()}
      onEditor={(nextEditor) => {
        editor = nextEditor
      }}
      onInteraction={(nextInteraction) => {
        interaction = nextInteraction
      }}
    />
  )

  act(() => editor.setSelection(["a", "b"]))
  act(() => {
    const groupId = editor.groupSelection()

    interaction.focusNode(groupId)
  })

  act(() => {
    const groupId = editor.blocks[0]?.id

    if (!groupId) throw new Error("expected a group block")

    const freedIds = editor.ungroup(groupId)

    interaction.focusNode(freedIds?.[0] ?? null)
  })

  expect(surfaceFor(0)).toHaveFocus()
})
