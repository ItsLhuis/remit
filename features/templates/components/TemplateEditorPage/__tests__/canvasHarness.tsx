import { useEffect } from "react"

import { act, cleanup, screen } from "@testing-library/react"

import { afterEach, beforeEach, vi } from "vitest"

import {
  useEditorInteraction,
  useTemplateEditor,
  type EditorInteraction,
  type TemplateEditorState
} from "../../../hooks"
import { type Block } from "../../../schemas"
import { buildSampleRenderData, DEFAULT_PAGE_SETTINGS } from "../../../services"
import { EditorCanvas } from "../EditorCanvas"

// Shared canvas-engine test harness: renders the real canvas over the real document store; tests
// read committed geometry from the block wrapper's style (what the user sees) and drive the
// engine with pointer events. happy-dom has no layout, so pointer coordinates are computed from
// the block model: page rect sits at (0, 0) and zoom is 1, making clientX = margins.left +
// content x. Each spec file registers the rAF stubs by calling setupCanvasTest() at the top level
// and mocks @/lib/i18n itself (vi.mock is file-scoped and cannot live here).

export const MARGINS = DEFAULT_PAGE_SETTINGS.margins

// Stable references, mirroring how TemplateEditorPage.tsx memoizes both (`useMemo` keyed on
// `template.type`, and on the resolved asset map): recreating either fresh in the harness's JSX
// every render would break every block's memoization on every commit, regardless of gesture type,
// independent of the engine's own behavior.
const SAMPLE_RENDER_DATA = buildSampleRenderData("invoice")
const EMPTY_ASSETS: Record<string, string> = {}

export function clientPointFor(contentX: number, contentY: number) {
  return { clientX: MARGINS.left + contentX, clientY: MARGINS.top + contentY }
}

export function surfaceFor(index = 0) {
  const surface = screen.getAllByRole("button", { name: /templates\.editor\.selectBlock/ })[index]

  if (!surface) throw new Error("expected a block surface")

  return surface
}

export function wrapperFor(surface: HTMLElement): HTMLElement {
  const wrapper = surface.parentElement

  if (!wrapper) throw new Error("expected a block wrapper")

  return wrapper
}

export function pageFor(surface: HTMLElement): Element {
  const page = surface.closest("[class*='bg-white']")

  if (!page) throw new Error("expected the page element")

  return page
}

let frameCallbacks: FrameRequestCallback[] = []

// The engine batches pointermove work into one rAF callback; tests drain that queue explicitly so
// each simulated frame runs exactly once, like a real display tick.
export function flushFrames() {
  act(() => {
    const callbacks = frameCallbacks

    frameCallbacks = []

    for (const callback of callbacks) callback(0)
  })
}

export function setupCanvasTest() {
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
}

export type HarnessProps = {
  blocks: Block[]
  onEditor?: (editor: TemplateEditorState) => void
  onInteraction?: (interaction: EditorInteraction) => void
}

const Harness = ({ blocks, onEditor, onInteraction }: HarnessProps) => {
  const editor = useTemplateEditor(blocks, "invoice", DEFAULT_PAGE_SETTINGS)
  const interaction = useEditorInteraction(editor)

  useEffect(() => {
    onEditor?.(editor)
    onInteraction?.(interaction)
  })

  return (
    <EditorCanvas
      editor={editor}
      interaction={interaction}
      type="invoice"
      renderData={SAMPLE_RENDER_DATA}
      assets={EMPTY_ASSETS}
      gridVisible
      tool="select"
      fitCounter={0}
      onRenameBlockRequest={() => {}}
    />
  )
}

export { Harness }
