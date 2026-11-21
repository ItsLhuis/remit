// @vitest-environment happy-dom

import { Profiler } from "react"

import { act, fireEvent, render, screen } from "@testing-library/react"

import { expect, test, vi } from "vitest"

import { makeShapeBlock, makeTextBlock } from "@/tests/factories/blocks"

import { type EditorInteraction, type TemplateEditorState } from "../../../hooks"

import {
  clientPointFor,
  flushFrames,
  Harness,
  pageFor,
  setupCanvasTest,
  surfaceFor,
  wrapperFor,
  MARGINS
} from "./canvasHarness"

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {},
    ready: true,
    locales: {}
  })
}))

setupCanvasTest()

test("a pointer drag commits start plus delta and clears the inline transform with the commit", () => {
  render(<Harness blocks={[makeShapeBlock({ id: "shape", layout: { x: 0, y: 0 } })]} />)

  const surface = surfaceFor()
  const wrapper = wrapperFor(surface)
  const start = clientPointFor(80, 48)

  fireEvent.pointerDown(surface, { button: 0, pointerId: 1, ...start })
  fireEvent.pointerMove(surface, {
    pointerId: 1,
    clientX: start.clientX + 96,
    clientY: start.clientY + 64
  })
  flushFrames()

  expect(wrapper.style.transform).toBe("translate(96px, 64px)")
  expect(wrapper.style.left).toBe(`${MARGINS.left}px`)

  fireEvent.pointerUp(surface, {
    pointerId: 1,
    clientX: start.clientX + 96,
    clientY: start.clientY + 64
  })

  expect(wrapper.style.left).toBe(`${MARGINS.left + 96}px`)
  expect(wrapper.style.top).toBe(`${MARGINS.top + 64}px`)
  expect(wrapper.style.transform).toBe("")
})

test("pointer movement during a drag causes zero React commits", () => {
  let commits = 0

  render(
    <Profiler
      id="editor-canvas"
      onRender={() => {
        commits += 1
      }}
    >
      <Harness blocks={[makeShapeBlock({ id: "shape", layout: { x: 0, y: 0 } })]} />
    </Profiler>
  )

  const surface = surfaceFor()
  const wrapper = wrapperFor(surface)
  const start = clientPointFor(80, 48)

  fireEvent.pointerDown(surface, { button: 0, pointerId: 1, ...start })
  fireEvent.pointerMove(surface, {
    pointerId: 1,
    clientX: start.clientX + 16,
    clientY: start.clientY + 16
  })
  flushFrames()

  const commitsAfterActivation = commits

  fireEvent.pointerMove(surface, {
    pointerId: 1,
    clientX: start.clientX + 32,
    clientY: start.clientY + 24
  })
  flushFrames()
  fireEvent.pointerMove(surface, {
    pointerId: 1,
    clientX: start.clientX + 48,
    clientY: start.clientY + 40
  })
  flushFrames()
  fireEvent.pointerMove(surface, {
    pointerId: 1,
    clientX: start.clientX + 64,
    clientY: start.clientY + 56
  })
  flushFrames()

  expect(commits).toBe(commitsAfterActivation)
  expect(wrapper.style.transform).toBe("translate(64px, 56px)")
})

test("a drag with Alt held commits an off-grid whole-pixel position", () => {
  render(<Harness blocks={[makeShapeBlock({ id: "shape", layout: { x: 0, y: 0 } })]} />)

  const surface = surfaceFor()
  const wrapper = wrapperFor(surface)
  const start = clientPointFor(80, 48)

  fireEvent.keyDown(window, { key: "Alt", altKey: true })

  fireEvent.pointerDown(surface, { button: 0, pointerId: 1, ...start })
  fireEvent.pointerMove(surface, {
    pointerId: 1,
    clientX: start.clientX + 21,
    clientY: start.clientY + 13
  })
  flushFrames()
  fireEvent.pointerUp(surface, {
    pointerId: 1,
    clientX: start.clientX + 21,
    clientY: start.clientY + 13
  })

  fireEvent.keyUp(window, { key: "Alt", altKey: false })

  expect(wrapper.style.left).toBe(`${MARGINS.left + 21}px`)
  expect(wrapper.style.top).toBe(`${MARGINS.top + 13}px`)
})

test("Shift locks a drag to the dominant axis", () => {
  render(<Harness blocks={[makeShapeBlock({ id: "shape", layout: { x: 0, y: 0 } })]} />)

  const surface = surfaceFor()
  const wrapper = wrapperFor(surface)
  const start = clientPointFor(80, 48)

  fireEvent.pointerDown(surface, { button: 0, pointerId: 1, ...start })
  fireEvent.pointerMove(surface, {
    pointerId: 1,
    clientX: start.clientX + 64,
    clientY: start.clientY + 16,
    shiftKey: true
  })
  flushFrames()
  fireEvent.pointerUp(surface, {
    pointerId: 1,
    clientX: start.clientX + 64,
    clientY: start.clientY + 16,
    shiftKey: true
  })

  expect(wrapper.style.left).toBe(`${MARGINS.left + 64}px`)
  expect(wrapper.style.top).toBe(`${MARGINS.top}px`)
})

test("click selects, empty click clears, and shift-click toggles the selection", () => {
  render(<Harness blocks={[makeShapeBlock({ id: "shape", layout: { x: 0, y: 0 } })]} />)

  const surface = surfaceFor()
  const onBlock = clientPointFor(80, 48)
  const onEmpty = clientPointFor(600, 600)

  fireEvent.pointerDown(surface, { button: 0, pointerId: 1, ...onBlock })
  fireEvent.pointerUp(surface, { pointerId: 1, ...onBlock })

  expect(surface).toHaveAttribute("aria-pressed", "true")

  const page = surface.closest("[class*='bg-white']")

  if (!page) throw new Error("expected the page element")

  fireEvent.pointerDown(page, { button: 0, pointerId: 1, ...onEmpty })
  fireEvent.pointerUp(page, { pointerId: 1, ...onEmpty })

  expect(surface).toHaveAttribute("aria-pressed", "false")

  fireEvent.pointerDown(surface, { button: 0, pointerId: 1, shiftKey: true, ...onBlock })
  fireEvent.pointerUp(surface, { pointerId: 1, shiftKey: true, ...onBlock })

  expect(surface).toHaveAttribute("aria-pressed", "true")

  fireEvent.pointerDown(surface, { button: 0, pointerId: 1, shiftKey: true, ...onBlock })
  fireEvent.pointerUp(surface, { pointerId: 1, shiftKey: true, ...onBlock })

  expect(surface).toHaveAttribute("aria-pressed", "false")
})

// A second pointer's move/up must not affect an in-progress drag started by another
// pointer (e.g. an incidental touch while dragging with the mouse).
test("a second pointer's events are ignored while another pointer's drag is active", () => {
  render(<Harness blocks={[makeShapeBlock({ id: "shape", layout: { x: 0, y: 0 } })]} />)

  const surface = surfaceFor()
  const wrapper = wrapperFor(surface)
  const start = clientPointFor(80, 48)

  fireEvent.pointerDown(surface, { button: 0, pointerId: 1, ...start })
  fireEvent.pointerMove(surface, {
    pointerId: 1,
    clientX: start.clientX + 16,
    clientY: start.clientY + 16
  })
  flushFrames()

  fireEvent.pointerMove(surface, {
    pointerId: 2,
    clientX: start.clientX + 999,
    clientY: start.clientY + 999
  })
  flushFrames()
  fireEvent.pointerUp(surface, {
    pointerId: 2,
    clientX: start.clientX + 999,
    clientY: start.clientY + 999
  })

  expect(wrapper.style.transform).toBe("translate(16px, 16px)")

  fireEvent.pointerMove(surface, {
    pointerId: 1,
    clientX: start.clientX + 32,
    clientY: start.clientY + 24
  })
  flushFrames()
  fireEvent.pointerUp(surface, {
    pointerId: 1,
    clientX: start.clientX + 32,
    clientY: start.clientY + 24
  })

  expect(wrapper.style.left).toBe(`${MARGINS.left + 32}px`)
  expect(wrapper.style.top).toBe(`${MARGINS.top + 24}px`)
})

// Escape mid-press cancels only that press and never falls through to clearing the
// selection; Escape with no press in progress still clears it.
test("Escape during an armed but not-yet-activated press cancels the press without clearing the selection", () => {
  render(<Harness blocks={[makeShapeBlock({ id: "shape", layout: { x: 0, y: 0 } })]} />)

  const surface = surfaceFor()
  const onBlock = clientPointFor(80, 48)
  const onEmpty = clientPointFor(600, 600)

  fireEvent.pointerDown(surface, { button: 0, pointerId: 1, ...onBlock })
  fireEvent.pointerUp(surface, { pointerId: 1, ...onBlock })

  expect(surface).toHaveAttribute("aria-pressed", "true")

  const page = surface.closest("[class*='bg-white']")

  if (!page) throw new Error("expected the page element")

  fireEvent.pointerDown(page, { button: 0, pointerId: 1, ...onEmpty })
  fireEvent.keyDown(page, { key: "Escape" })
  fireEvent.pointerUp(page, { pointerId: 1, ...onEmpty })

  expect(surface).toHaveAttribute("aria-pressed", "true")
})

test("Escape with no press in progress clears the selection", () => {
  render(<Harness blocks={[makeShapeBlock({ id: "shape", layout: { x: 0, y: 0 } })]} />)

  const surface = surfaceFor()
  const onBlock = clientPointFor(80, 48)

  fireEvent.pointerDown(surface, { button: 0, pointerId: 1, ...onBlock })
  fireEvent.pointerUp(surface, { pointerId: 1, ...onBlock })

  expect(surface).toHaveAttribute("aria-pressed", "true")

  fireEvent.keyDown(surface, { key: "Escape" })

  expect(surface).toHaveAttribute("aria-pressed", "false")
})

test("a drag is one undo entry", () => {
  const captured = { editor: null as TemplateEditorState | null }

  render(
    <Harness
      blocks={[makeShapeBlock({ id: "shape", layout: { x: 0, y: 0 } })]}
      onEditor={(current) => {
        captured.editor = current
      }}
    />
  )

  const surface = surfaceFor()
  const wrapper = wrapperFor(surface)
  const start = clientPointFor(80, 48)

  fireEvent.pointerDown(surface, { button: 0, pointerId: 1, ...start })
  fireEvent.pointerMove(surface, {
    pointerId: 1,
    clientX: start.clientX + 32,
    clientY: start.clientY + 24
  })
  flushFrames()
  fireEvent.pointerMove(surface, {
    pointerId: 1,
    clientX: start.clientX + 96,
    clientY: start.clientY + 64
  })
  flushFrames()
  fireEvent.pointerUp(surface, {
    pointerId: 1,
    clientX: start.clientX + 96,
    clientY: start.clientY + 64
  })

  expect(wrapper.style.left).toBe(`${MARGINS.left + 96}px`)

  act(() => {
    captured.editor?.undo()
  })

  expect(wrapper.style.left).toBe(`${MARGINS.left}px`)
  expect(captured.editor?.canUndo).toBe(false)
})

test("a marquee drag from empty page selects every intersecting top-level block", () => {
  render(
    <Harness
      blocks={[
        makeShapeBlock({ id: "a", layout: { x: 0, y: 0 } }),
        makeShapeBlock({ id: "b", layout: { x: 240, y: 0 } })
      ]}
    />
  )

  const first = surfaceFor(0)
  const second = surfaceFor(1)
  const page = pageFor(first)
  const start = clientPointFor(600, 300)
  const end = clientPointFor(10, 10)

  fireEvent.pointerDown(page, { button: 0, pointerId: 1, ...start })
  fireEvent.pointerMove(page, { pointerId: 1, ...end })
  flushFrames()
  fireEvent.pointerUp(page, { pointerId: 1, ...end })

  expect(first).toHaveAttribute("aria-pressed", "true")
  expect(second).toHaveAttribute("aria-pressed", "true")
})

test("a shift-marquee toggles the caught blocks against the existing selection", () => {
  render(
    <Harness
      blocks={[
        makeShapeBlock({ id: "a", layout: { x: 0, y: 0 } }),
        makeShapeBlock({ id: "b", layout: { x: 240, y: 0 } })
      ]}
    />
  )

  const first = surfaceFor(0)
  const second = surfaceFor(1)
  const page = pageFor(first)
  const onFirst = clientPointFor(80, 48)

  fireEvent.pointerDown(first, { button: 0, pointerId: 1, ...onFirst })
  fireEvent.pointerUp(first, { pointerId: 1, ...onFirst })

  const start = clientPointFor(600, 300)
  const end = clientPointFor(220, 10)

  fireEvent.pointerDown(page, { button: 0, pointerId: 1, shiftKey: true, ...start })
  fireEvent.pointerMove(page, { pointerId: 1, shiftKey: true, ...end })
  flushFrames()
  fireEvent.pointerUp(page, { pointerId: 1, shiftKey: true, ...end })

  expect(first).toHaveAttribute("aria-pressed", "true")
  expect(second).toHaveAttribute("aria-pressed", "true")
})

test("dragging one member of a multi-selection moves the whole set and undoes in one step", () => {
  const captured = { editor: null as TemplateEditorState | null }

  render(
    <Harness
      blocks={[
        makeShapeBlock({ id: "a", layout: { x: 0, y: 0 } }),
        makeShapeBlock({ id: "b", layout: { x: 240, y: 120 } })
      ]}
      onEditor={(current) => {
        captured.editor = current
      }}
    />
  )

  act(() => {
    captured.editor?.setSelection(["a", "b"])
  })

  const first = surfaceFor(0)
  const firstWrapper = wrapperFor(first)
  const secondWrapper = wrapperFor(surfaceFor(1))
  const start = clientPointFor(80, 48)

  fireEvent.pointerDown(first, { button: 0, pointerId: 1, ...start })
  fireEvent.pointerMove(first, {
    pointerId: 1,
    clientX: start.clientX + 32,
    clientY: start.clientY + 16
  })
  flushFrames()

  expect(firstWrapper.style.transform).toBe("translate(32px, 16px)")
  expect(secondWrapper.style.transform).toBe("translate(32px, 16px)")

  fireEvent.pointerUp(first, {
    pointerId: 1,
    clientX: start.clientX + 32,
    clientY: start.clientY + 16
  })

  expect(firstWrapper.style.left).toBe(`${MARGINS.left + 32}px`)
  expect(secondWrapper.style.left).toBe(`${MARGINS.left + 240 + 32}px`)

  act(() => {
    captured.editor?.undo()
  })

  expect(firstWrapper.style.left).toBe(`${MARGINS.left}px`)
  expect(secondWrapper.style.left).toBe(`${MARGINS.left + 240}px`)
  expect(captured.editor?.canUndo).toBe(false)
})

test("Escape mid multi-drag cancels and restores every member exactly", () => {
  const captured = { editor: null as TemplateEditorState | null }

  render(
    <Harness
      blocks={[
        makeShapeBlock({ id: "a", layout: { x: 0, y: 0 } }),
        makeShapeBlock({ id: "b", layout: { x: 240, y: 120 } })
      ]}
      onEditor={(current) => {
        captured.editor = current
      }}
    />
  )

  act(() => {
    captured.editor?.setSelection(["a", "b"])
  })

  const first = surfaceFor(0)
  const firstWrapper = wrapperFor(first)
  const secondWrapper = wrapperFor(surfaceFor(1))
  const start = clientPointFor(80, 48)

  fireEvent.pointerDown(first, { button: 0, pointerId: 1, ...start })
  fireEvent.pointerMove(first, {
    pointerId: 1,
    clientX: start.clientX + 32,
    clientY: start.clientY + 16
  })
  flushFrames()

  fireEvent.keyDown(pageFor(first), { key: "Escape" })

  expect(firstWrapper.style.transform).toBe("")
  expect(secondWrapper.style.transform).toBe("")
  expect(firstWrapper.style.left).toBe(`${MARGINS.left}px`)
  expect(secondWrapper.style.left).toBe(`${MARGINS.left + 240}px`)
  expect(captured.editor?.canUndo).toBe(false)
})

// A pointerdown that lands inside the active inline text-editing surface is native text
// interaction and must never arm a move, even when it drags past the activation threshold.
test("a pointerdown inside an editing block's text surface arms no gesture", () => {
  const captured = { interaction: null as EditorInteraction | null }

  render(
    <Harness
      blocks={[makeTextBlock({ id: "text", layout: { x: 0, y: 0, width: 160, height: 96 } })]}
      onInteraction={(current) => {
        captured.interaction = current
      }}
    />
  )

  act(() => {
    captured.interaction?.startTextEdit("text")
  })

  const editable = screen.getByRole("textbox")
  const wrapper = wrapperFor(editable)
  const start = clientPointFor(40, 20)

  fireEvent.pointerDown(editable, { button: 0, pointerId: 1, ...start })
  fireEvent.pointerMove(editable, {
    pointerId: 1,
    clientX: start.clientX + 96,
    clientY: start.clientY + 64
  })
  flushFrames()

  expect(wrapper.style.transform).toBe("")
})
