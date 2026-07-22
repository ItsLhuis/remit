// @vitest-environment happy-dom

import { type ComponentProps, type ReactNode } from "react"

import { act, fireEvent, render } from "@testing-library/react"

import { afterEach, expect, test, vi } from "vitest"

import { makeShapeBlock } from "@/tests/factories/blocks"

import { type TemplateEditorState } from "../../../hooks"
import { CanvasBlock } from "../CanvasBlock"

import { clientPointFor, flushFrames, Harness, setupCanvasTest, surfaceFor } from "./canvasHarness"

// Proves technique 7 (section 11) at the scale the plan calls for: 30+ blocks on the page, one or a
// few of them participating in a gesture. `CanvasBlock` is `memo`-wrapped with no custom comparator,
// so React resolves it to a SimpleMemoComponent fiber whose `.type` is read from the wrapper's
// `.type` property once, at that fiber's creation - patching the property after a block has already
// mounted is invisible to later updates of that same fiber. The tracker below is therefore installed
// before the very first render in every test, so it observes every render (mount and update) of
// every block for the rest of that test.

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {},
    ready: true,
    locales: {}
  })
}))

setupCanvasTest()

const BLOCK_COUNT = 32
const GRID_COLUMNS = 8
const BLOCK_SIZE = 64
const CELL = BLOCK_SIZE + 24

function makeBlockGrid(count: number) {
  return Array.from({ length: count }, (_, index) =>
    makeShapeBlock({
      id: `block-${index}`,
      layout: {
        x: (index % GRID_COLUMNS) * CELL,
        y: Math.floor(index / GRID_COLUMNS) * CELL,
        width: BLOCK_SIZE,
        height: BLOCK_SIZE
      }
    })
  )
}

type TrackedCanvasBlockProps = ComponentProps<typeof CanvasBlock>
type CanvasBlockRenderer = (props: TrackedCanvasBlockProps) => ReactNode

let restoreTracking: (() => void) | null = null

afterEach(() => {
  restoreTracking?.()
  restoreTracking = null
})

// Must be called before the first `render()` of the test - see the file header comment.
function trackBlockRenders(): Map<string, number> {
  const counts = new Map<string, number>()
  const target = CanvasBlock as unknown as { type: CanvasBlockRenderer }
  const original = target.type

  target.type = (props) => {
    counts.set(props.block.id, (counts.get(props.block.id) ?? 0) + 1)

    return original(props)
  }

  restoreTracking = () => {
    target.type = original
  }

  return counts
}

test("dragging one block among 32 renders no block body while dragging and only the moved block at commit", () => {
  const counts = trackBlockRenders()

  render(<Harness blocks={makeBlockGrid(BLOCK_COUNT)} />)

  const surface = surfaceFor(0)
  const start = clientPointFor(BLOCK_SIZE / 2, BLOCK_SIZE / 2)

  fireEvent.pointerDown(surface, { button: 0, pointerId: 1, ...start })
  fireEvent.pointerMove(surface, {
    pointerId: 1,
    clientX: start.clientX + 8,
    clientY: start.clientY + 8
  })
  flushFrames()
  counts.clear()
  fireEvent.pointerMove(surface, {
    pointerId: 1,
    clientX: start.clientX + 16,
    clientY: start.clientY + 16
  })
  flushFrames()
  fireEvent.pointerMove(surface, {
    pointerId: 1,
    clientX: start.clientX + 24,
    clientY: start.clientY + 24
  })
  flushFrames()

  expect(counts.size).toBe(0)

  fireEvent.pointerUp(surface, {
    pointerId: 1,
    clientX: start.clientX + 24,
    clientY: start.clientY + 24
  })

  expect([...counts.entries()]).toEqual([["block-0", 1]])
})

test("resizing one selected block among 32 renders no block body while dragging and only the resized block at commit", () => {
  const counts = trackBlockRenders()

  render(<Harness blocks={makeBlockGrid(BLOCK_COUNT)} />)

  fireEvent.click(surfaceFor(0))

  const handle = document.querySelector('[data-resize-handle="se"]')

  if (!handle) throw new Error("expected a resize handle to render for the selected block")

  counts.clear()

  const start = clientPointFor(BLOCK_SIZE, BLOCK_SIZE)

  fireEvent.pointerDown(handle, { button: 0, pointerId: 1, ...start })
  fireEvent.pointerMove(handle, {
    pointerId: 1,
    clientX: start.clientX + 16,
    clientY: start.clientY + 8
  })
  flushFrames()
  counts.clear()
  fireEvent.pointerMove(handle, {
    pointerId: 1,
    clientX: start.clientX + 32,
    clientY: start.clientY + 16
  })
  flushFrames()
  fireEvent.pointerMove(handle, {
    pointerId: 1,
    clientX: start.clientX + 48,
    clientY: start.clientY + 24
  })
  flushFrames()

  expect(counts.size).toBe(0)

  fireEvent.pointerUp(handle, {
    pointerId: 1,
    clientX: start.clientX + 48,
    clientY: start.clientY + 24
  })

  expect([...counts.entries()]).toEqual([["block-0", 1]])
})

test("rotating one selected block among 32 renders no block body while dragging and only the rotated block at commit", () => {
  const counts = trackBlockRenders()

  render(<Harness blocks={makeBlockGrid(BLOCK_COUNT)} />)

  fireEvent.click(surfaceFor(0))

  const zone = document.querySelector('[data-rotate-zone="se"]')

  if (!zone) throw new Error("expected a rotate zone to render for the selected block")

  // LiveOverlay only keeps a resize gesture's own handles mounted through its drag (the
  // `overlay.gesture.kind === "resize"` carve-out); a rotate zone unmounts once its gesture
  // activates, replaced by the live rotation badge. A real browser keeps routing pointer events to
  // wherever `setPointerCapture` sent them regardless of what unmounts; happy-dom has no pointer
  // capture, so every event after activation must target a stable ancestor instead of the vanished
  // zone button - the page element, exactly like the marquee drag below.
  const page = surfaceFor(0).closest("[class*='bg-white']")

  if (!page) throw new Error("expected the page element")

  counts.clear()

  // happy-dom lays nothing out (every element's real bounding box is zero), so the drag orbits a
  // synthetic point around the block's own model-derived center - identical technique to the e2e
  // rotate spec's `orbit` helper, just driven off content coordinates instead of real geometry.
  const center = clientPointFor(BLOCK_SIZE / 2, BLOCK_SIZE / 2)
  const corner = clientPointFor(BLOCK_SIZE, BLOCK_SIZE)

  const orbit = (degrees: number) => {
    const radians = (degrees * Math.PI) / 180
    const dx = corner.clientX - center.clientX
    const dy = corner.clientY - center.clientY

    return {
      clientX: center.clientX + dx * Math.cos(radians) - dy * Math.sin(radians),
      clientY: center.clientY + dx * Math.sin(radians) + dy * Math.cos(radians)
    }
  }

  fireEvent.pointerDown(zone, { button: 0, pointerId: 1, ...corner })
  fireEvent.pointerMove(page, { pointerId: 1, ...orbit(10) })
  flushFrames()
  counts.clear()
  fireEvent.pointerMove(page, { pointerId: 1, ...orbit(20) })
  flushFrames()
  fireEvent.pointerMove(page, { pointerId: 1, ...orbit(29) })
  flushFrames()

  expect(counts.size).toBe(0)

  fireEvent.pointerUp(page, { pointerId: 1, ...orbit(29) })

  expect([...counts.entries()]).toEqual([["block-0", 1]])
})

test("a marquee drag over 32 blocks renders no block body while dragging", () => {
  const counts = trackBlockRenders()

  render(<Harness blocks={makeBlockGrid(BLOCK_COUNT)} />)

  const surface = surfaceFor(0)
  const page = surface.closest("[class*='bg-white']")

  if (!page) throw new Error("expected the page element")

  const start = clientPointFor(7 * CELL + BLOCK_SIZE + 40, 3 * CELL + BLOCK_SIZE + 40)
  const midway = clientPointFor(4 * CELL, 2 * CELL)
  const end = clientPointFor(0, 0)

  fireEvent.pointerDown(page, { button: 0, pointerId: 1, ...start })
  fireEvent.pointerMove(page, { pointerId: 1, ...midway })
  flushFrames()
  counts.clear()
  fireEvent.pointerMove(page, { pointerId: 1, ...end })
  flushFrames()

  expect(counts.size).toBe(0)

  fireEvent.pointerUp(page, { pointerId: 1, ...end })
})

test("multi-selection resize among 32 blocks scales only the selected members at commit", () => {
  const counts = trackBlockRenders()
  const captured = { editor: null as TemplateEditorState | null }

  render(
    <Harness
      blocks={makeBlockGrid(BLOCK_COUNT)}
      onEditor={(nextEditor) => {
        captured.editor = nextEditor
      }}
    />
  )

  act(() => {
    captured.editor?.setSelection(["block-0", "block-1"])
  })

  const handle = document.querySelector('[data-resize-handle="se"]')

  if (!handle) throw new Error("expected a resize handle to render for the multi-selection")

  counts.clear()

  // happy-dom has no layout, so the handle's real bounding box is zero; only the pointer delta
  // across the gesture drives resize math (the handle direction itself comes from the
  // data-resize-handle attribute the fireEvent target carries), so an arbitrary start point works.
  const start = clientPointFor(0, 0)

  fireEvent.pointerDown(handle, { button: 0, pointerId: 1, ...start })
  fireEvent.pointerMove(handle, {
    pointerId: 1,
    clientX: start.clientX + 40,
    clientY: start.clientY + 24
  })
  flushFrames()
  counts.clear()
  fireEvent.pointerMove(handle, {
    pointerId: 1,
    clientX: start.clientX + 80,
    clientY: start.clientY + 48
  })
  flushFrames()

  expect(counts.size).toBe(0)

  fireEvent.pointerUp(handle, {
    pointerId: 1,
    clientX: start.clientX + 80,
    clientY: start.clientY + 48
  })

  expect(new Set(counts.keys())).toEqual(new Set(["block-0", "block-1"]))
})

test("group resize among 32 blocks scales only the group and its members at commit", () => {
  const counts = trackBlockRenders()
  const captured = { editor: null as TemplateEditorState | null }

  render(
    <Harness
      blocks={makeBlockGrid(BLOCK_COUNT)}
      onEditor={(nextEditor) => {
        captured.editor = nextEditor
      }}
    />
  )

  act(() => {
    captured.editor?.setSelection(["block-0", "block-1"])
  })

  let groupId: string | null = null

  act(() => {
    groupId = captured.editor?.groupSelection() ?? null
  })

  if (!groupId) throw new Error("expected groupSelection to create a group")

  act(() => {
    captured.editor?.setSelection([groupId as string])
  })

  const handle = document.querySelector('[data-resize-handle="se"]')

  if (!handle) throw new Error("expected a resize handle to render for the group")

  counts.clear()

  const start = clientPointFor(0, 0)

  fireEvent.pointerDown(handle, { button: 0, pointerId: 1, ...start })
  fireEvent.pointerMove(handle, {
    pointerId: 1,
    clientX: start.clientX + 40,
    clientY: start.clientY + 24
  })
  flushFrames()
  counts.clear()
  fireEvent.pointerMove(handle, {
    pointerId: 1,
    clientX: start.clientX + 80,
    clientY: start.clientY + 48
  })
  flushFrames()

  expect(counts.size).toBe(0)

  fireEvent.pointerUp(handle, {
    pointerId: 1,
    clientX: start.clientX + 80,
    clientY: start.clientY + 48
  })

  const renderedIds = new Set(counts.keys())

  expect(renderedIds.has("block-0")).toBe(true)
  expect(renderedIds.has("block-1")).toBe(true)
  expect(renderedIds.has(groupId)).toBe(true)

  for (let index = 2; index < BLOCK_COUNT; index += 1) {
    expect(renderedIds.has(`block-${index}`)).toBe(false)
  }
})
