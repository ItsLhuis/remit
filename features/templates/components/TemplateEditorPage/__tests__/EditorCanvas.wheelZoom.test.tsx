// @vitest-environment happy-dom

import { act, render } from "@testing-library/react"

import { expect, test, vi } from "vitest"

import { makeShapeBlock } from "@/tests/factories/blocks"

import { type TemplateEditorState } from "../../../hooks"

import { flushFrames, Harness, setupCanvasTest } from "./canvasHarness"

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {},
    ready: true,
    locales: {}
  })
}))

setupCanvasTest()

// happy-dom's WheelEvent does not accept ctrlKey through its constructor init dict, so it is
// stamped onto the dispatched event directly; this is the only reliable way to simulate a
// Ctrl+wheel tick under this test environment.
function dispatchCtrlWheel(target: HTMLElement, deltaY: number, clientX: number, clientY: number) {
  const event = new WheelEvent("wheel", {
    deltaY,
    clientX,
    clientY,
    bubbles: true,
    cancelable: true
  })

  Object.defineProperty(event, "ctrlKey", { value: true })
  target.dispatchEvent(event)
}

// Pins the anchor-ref lifecycle: a Ctrl+wheel tick that clamps to the current zoom (already at
// the limit) is a no-op state set, so React never re-renders and the scroll-adjusting layout
// effect never runs to clear the anchor it stashed. Left stale, the next unrelated zoom change
// (here simulating a toolbar/hotkey zoom) must not resurrect and misapply that old anchor.
test("a wheel zoom clamped to a no-op does not leave a stale anchor for the next zoom change", () => {
  let editor: TemplateEditorState | undefined

  const { container } = render(
    <Harness
      blocks={[makeShapeBlock({ id: "shape", layout: { x: 0, y: 0 } })]}
      onEditor={(state) => {
        editor = state
      }}
    />
  )

  if (!editor) throw new Error("expected editor state")

  const scroll = container.querySelector(".overflow-auto")

  if (!(scroll instanceof HTMLElement)) throw new Error("expected the scroll container")

  act(() => {
    editor?.setZoom(2)
  })

  scroll.scrollLeft = 500
  scroll.scrollTop = 300

  act(() => {
    dispatchCtrlWheel(scroll, -120, 200, 150)
  })

  flushFrames()

  act(() => {
    editor?.setZoom(1.5)
  })

  expect(scroll.scrollLeft).toBe(500)
  expect(scroll.scrollTop).toBe(300)
})
