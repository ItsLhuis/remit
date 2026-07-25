// @vitest-environment happy-dom

import { act, renderHook } from "@testing-library/react"

import { afterEach, expect, test, vi } from "vitest"

import { useMeasuredWidth } from "../useMeasuredWidth"

type ObserverCallback = (entries: { contentRect: { width: number } }[]) => void

const observed: { callback: ObserverCallback; disconnect: () => void }[] = []

class StubResizeObserver {
  private callback: ObserverCallback

  constructor(callback: ObserverCallback) {
    this.callback = callback
  }

  observe() {
    observed.push({ callback: this.callback, disconnect: this.disconnect })
  }

  disconnect = vi.fn()
}

vi.stubGlobal("ResizeObserver", StubResizeObserver)

afterEach(() => {
  observed.length = 0
})

test("reports zero width until the observed element is measured", () => {
  const { result } = renderHook(() => useMeasuredWidth())

  act(() => result.current.ref(document.createElement("div")))

  expect(result.current.width).toBe(0)
})

test("reports the observed content width when the element resizes", () => {
  const { result } = renderHook(() => useMeasuredWidth())

  act(() => result.current.ref(document.createElement("div")))
  act(() => observed[0]?.callback([{ contentRect: { width: 640 } }]))

  expect(result.current.width).toBe(640)
})

test("stops observing when the hook unmounts", () => {
  const { result, unmount } = renderHook(() => useMeasuredWidth())

  act(() => result.current.ref(document.createElement("div")))
  unmount()

  expect(observed[0]?.disconnect).toHaveBeenCalled()
})
