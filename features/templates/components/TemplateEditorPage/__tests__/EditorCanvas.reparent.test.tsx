// @vitest-environment happy-dom

import { act, fireEvent, render } from "@testing-library/react"

import { expect, test, vi } from "vitest"

import { makeFrameBlock, makeShapeBlock } from "@/tests/factories/blocks"

import { type TemplateEditorState } from "../../../hooks"

import { clientPointFor, flushFrames, Harness, setupCanvasTest, surfaceFor } from "./canvasHarness"

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {},
    ready: true,
    locales: {}
  })
}))

setupCanvasTest()

test("dropping a block over a frame reparents it into the frame", () => {
  const captured = { editor: null as TemplateEditorState | null }

  render(
    <Harness
      blocks={[
        makeFrameBlock({ id: "frame", layout: { x: 240, y: 300, width: 480, height: 240 } }),
        makeShapeBlock({ id: "shape", layout: { x: 0, y: 0 } })
      ]}
      onEditor={(current) => {
        captured.editor = current
      }}
    />
  )

  const surface = surfaceFor(1)
  const start = clientPointFor(80, 48)
  const drop = clientPointFor(400, 400)

  fireEvent.pointerDown(surface, { button: 0, pointerId: 1, ...start })
  fireEvent.pointerMove(surface, { pointerId: 1, ...drop })
  flushFrames()
  fireEvent.pointerUp(surface, { pointerId: 1, ...drop })

  expect(captured.editor).not.toBeNull()

  const frame = captured.editor?.blocks.find((block) => block.id === "frame")

  expect(frame?.type).toBe("frame")
  expect(frame?.type === "frame" ? frame.content.children.map((child) => child.id) : []).toEqual([
    "shape"
  ])
})

test("dropping a multi-selection over a frame reparents every member, preserving relative offsets", () => {
  const captured = { editor: null as TemplateEditorState | null }

  render(
    <Harness
      blocks={[
        makeFrameBlock({ id: "frame", layout: { x: 240, y: 300, width: 480, height: 240 } }),
        makeShapeBlock({ id: "a", layout: { x: 0, y: 0 } }),
        makeShapeBlock({ id: "b", layout: { x: 0, y: 120 } })
      ]}
      onEditor={(current) => {
        captured.editor = current
      }}
    />
  )

  const a = surfaceFor(1)
  const b = surfaceFor(2)
  const onA = clientPointFor(80, 48)
  const onB = clientPointFor(80, 168)
  const drop = clientPointFor(400, 400)

  fireEvent.pointerDown(a, { button: 0, pointerId: 1, ...onA })
  fireEvent.pointerUp(a, { pointerId: 1, ...onA })

  fireEvent.pointerDown(b, { button: 0, pointerId: 1, shiftKey: true, ...onB })
  fireEvent.pointerUp(b, { pointerId: 1, shiftKey: true, ...onB })

  fireEvent.pointerDown(a, { button: 0, pointerId: 1, ...onA })
  fireEvent.pointerMove(a, { pointerId: 1, ...drop })
  flushFrames()
  fireEvent.pointerUp(a, { pointerId: 1, ...drop })

  expect(captured.editor?.blocks.map((block) => block.id)).toEqual(["frame"])

  const frame = captured.editor?.blocks.find((block) => block.id === "frame")
  const children = frame?.type === "frame" ? frame.content.children : []

  expect(children.map((child) => child.id)).toEqual(["a", "b"])
  expect(children.find((child) => child.id === "a")?.layout).toMatchObject({ x: 80, y: 52 })
  expect(children.find((child) => child.id === "b")?.layout).toMatchObject({ x: 80, y: 172 })

  act(() => {
    captured.editor?.undo()
  })

  expect(captured.editor?.blocks.map((block) => block.id).toSorted()).toEqual(["a", "b", "frame"])
  expect(captured.editor?.canUndo).toBe(false)
})

test("refuses a multi-selection reparent atomically when any member would need a negative frame-local coordinate, falling back to a plain move for all", () => {
  const captured = { editor: null as TemplateEditorState | null }

  render(
    <Harness
      blocks={[
        makeFrameBlock({ id: "frame", layout: { x: 240, y: 300, width: 480, height: 240 } }),
        makeShapeBlock({ id: "a", layout: { x: 0, y: 0 } }),
        makeShapeBlock({ id: "b", layout: { x: 160, y: 0 } })
      ]}
      onEditor={(current) => {
        captured.editor = current
      }}
    />
  )

  const a = surfaceFor(1)
  const b = surfaceFor(2)
  const onA = clientPointFor(80, 48)
  const onB = clientPointFor(240, 48)
  const drop = clientPointFor(296, 400)

  fireEvent.pointerDown(a, { button: 0, pointerId: 1, ...onA })
  fireEvent.pointerUp(a, { pointerId: 1, ...onA })

  fireEvent.pointerDown(b, { button: 0, pointerId: 1, shiftKey: true, ...onB })
  fireEvent.pointerUp(b, { pointerId: 1, shiftKey: true, ...onB })

  fireEvent.pointerDown(a, { button: 0, pointerId: 1, ...onA })
  fireEvent.pointerMove(a, { pointerId: 1, ...drop })
  flushFrames()
  fireEvent.pointerUp(a, { pointerId: 1, ...drop })

  const frame = captured.editor?.blocks.find((block) => block.id === "frame")

  expect(frame?.type === "frame" ? frame.content.children : []).toHaveLength(0)
  expect(captured.editor?.blocks.find((block) => block.id === "a")?.layout).toMatchObject({
    x: 216,
    y: 352
  })
  expect(captured.editor?.blocks.find((block) => block.id === "b")?.layout).toMatchObject({
    x: 376,
    y: 352
  })
})
