// @vitest-environment happy-dom

import { useEffect } from "react"

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"

import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { makeShapeBlock, makeTextBlock } from "@/tests/factories/blocks"

import { useEditorInteraction, useTemplateEditor, type EditorInteraction } from "../../../hooks"
import { type Block } from "../../../schemas"
import { buildSampleRenderData, DEFAULT_PAGE_SETTINGS } from "../../../services"
import { EditorCanvas } from "../EditorCanvas"

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {},
    ready: true,
    locales: {}
  })
}))

const MARGINS = DEFAULT_PAGE_SETTINGS.margins

type HarnessProps = {
  blocks: Block[]
  onInteraction: (interaction: EditorInteraction) => void
}

// The same real-canvas harness EditorCanvas.test.tsx uses (kept per-file, matching the component
// test convention there), trimmed to what the text-edit interplay needs: happy-dom has no layout,
// so pointer coordinates are computed from the block model with the page at (0, 0) and zoom 1.
const Harness = ({ blocks, onInteraction }: HarnessProps) => {
  const editor = useTemplateEditor(blocks, "invoice", DEFAULT_PAGE_SETTINGS)
  const interaction = useEditorInteraction(editor)

  useEffect(() => {
    onInteraction(interaction)
  })

  return (
    <EditorCanvas
      editor={editor}
      interaction={interaction}
      type="invoice"
      renderData={buildSampleRenderData("invoice")}
      assets={{}}
      gridVisible
      tool="select"
      fitCounter={0}
      onRenameBlockRequest={() => {}}
    />
  )
}

function clientPointFor(contentX: number, contentY: number) {
  return { clientX: MARGINS.left + contentX, clientY: MARGINS.top + contentY }
}

function surfaceFor(index = 0) {
  const surface = screen.getAllByRole("button", { name: /templates\.editor\.selectBlock/ })[index]

  if (!surface) throw new Error("expected a block surface")

  return surface
}

function pageFor(surface: HTMLElement): Element {
  const page = surface.closest("[class*='bg-white']")

  if (!page) throw new Error("expected the page element")

  return page
}

let frameCallbacks: FrameRequestCallback[] = []

function flushFrames() {
  act(() => {
    const callbacks = frameCallbacks

    frameCallbacks = []

    for (const callback of callbacks) callback(0)
  })
}

beforeEach(() => {
  frameCallbacks = []
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frameCallbacks.push(callback)

    return frameCallbacks.length
  })
  vi.stubGlobal("cancelAnimationFrame", () => {})
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// A marquee started on empty page while a text block is being edited commits the edit first (the
// text editor's capture-phase pointerdown) and then runs as an ordinary marquee.
test("a marquee during inline text editing commits the edit and still selects", () => {
  const captured = { interaction: null as EditorInteraction | null }

  render(
    <Harness
      blocks={[
        makeTextBlock({ id: "text", layout: { x: 0, y: 0, width: 160, height: 96 } }),
        makeShapeBlock({ id: "shape", layout: { x: 240, y: 120 } })
      ]}
      onInteraction={(current) => {
        captured.interaction = current
      }}
    />
  )

  act(() => {
    captured.interaction?.startTextEdit("text")
  })

  const page = pageFor(surfaceFor(0))
  const start = clientPointFor(600, 300)
  const end = clientPointFor(10, 10)

  fireEvent.pointerDown(page, { button: 0, pointerId: 1, ...start })

  expect(captured.interaction?.editingTextId).toBeNull()

  fireEvent.pointerMove(page, { pointerId: 1, ...end })
  flushFrames()
  fireEvent.pointerUp(page, { pointerId: 1, ...end })

  expect(surfaceFor(0)).toHaveAttribute("aria-pressed", "true")
  expect(surfaceFor(1)).toHaveAttribute("aria-pressed", "true")
})
