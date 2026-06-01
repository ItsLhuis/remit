// @vitest-environment happy-dom

import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { act, cleanup, renderHook } from "@testing-library/react"

import { useScroll } from "../useScroll"

type ScrollMetrics = {
  clientHeight: number
  scrollHeight: number
  scrollTop: number
}

class ResizeObserverStub {
  observe() {}
  disconnect() {}
  unobserve() {}
}

function setScrollMetrics(element: HTMLDivElement, metrics: ScrollMetrics): void {
  Object.defineProperties(element, {
    clientHeight: {
      configurable: true,
      value: metrics.clientHeight
    },
    scrollHeight: {
      configurable: true,
      value: metrics.scrollHeight
    },
    scrollTop: {
      configurable: true,
      value: metrics.scrollTop,
      writable: true
    }
  })
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverStub)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test("exposes only downward scrolling when the container is at the top", () => {
  const element = document.createElement("div")
  setScrollMetrics(element, { clientHeight: 100, scrollHeight: 300, scrollTop: 0 })

  const { result } = renderHook(() => useScroll())

  act(() => {
    result.current.ref(element)
  })

  expect(result.current.canScrollUp).toBe(false)
  expect(result.current.canScrollDown).toBe(true)
})

test("exposes both scroll directions when the container is between the edges", () => {
  const element = document.createElement("div")
  setScrollMetrics(element, { clientHeight: 100, scrollHeight: 300, scrollTop: 0 })

  const { result } = renderHook(() => useScroll())

  act(() => {
    result.current.ref(element)
  })

  setScrollMetrics(element, { clientHeight: 100, scrollHeight: 300, scrollTop: 80 })

  act(() => {
    element.dispatchEvent(new Event("scroll"))
  })

  expect(result.current.canScrollUp).toBe(true)
  expect(result.current.canScrollDown).toBe(true)
})

test("exposes only upward scrolling when the container reaches the bottom", () => {
  const element = document.createElement("div")
  setScrollMetrics(element, { clientHeight: 100, scrollHeight: 300, scrollTop: 0 })

  const { result } = renderHook(() => useScroll())

  act(() => {
    result.current.ref(element)
  })

  setScrollMetrics(element, { clientHeight: 100, scrollHeight: 300, scrollTop: 199 })

  act(() => {
    element.dispatchEvent(new Event("scroll"))
  })

  expect(result.current.canScrollUp).toBe(true)
  expect(result.current.canScrollDown).toBe(false)
})
