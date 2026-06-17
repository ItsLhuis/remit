// @vitest-environment happy-dom

import { act, cleanup, renderHook } from "@testing-library/react"

import { afterEach, beforeEach, expect, test } from "vitest"

import { useIsMobile } from "../useIsMobile"

const mediaListeners = new Set<EventListenerOrEventListenerObject>()
type LegacyMediaQueryListener = (this: MediaQueryList, event: MediaQueryListEvent) => void

let originalInnerWidthDescriptor: PropertyDescriptor | undefined
let originalMatchMediaDescriptor: PropertyDescriptor | undefined

function setViewportWidth(width: number): void {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
    writable: true
  })
}

function dispatchMediaChange(): void {
  const event = new Event("change")

  for (const listener of mediaListeners) {
    if (typeof listener === "function") {
      listener(event)
    } else {
      listener.handleEvent(event)
    }
  }
}

beforeEach(() => {
  mediaListeners.clear()
  originalInnerWidthDescriptor = Object.getOwnPropertyDescriptor(window, "innerWidth")
  originalMatchMediaDescriptor = Object.getOwnPropertyDescriptor(window, "matchMedia")

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string): MediaQueryList => {
      const legacyListeners = new Map<LegacyMediaQueryListener, EventListener>()

      const mediaQueryList = {
        matches: window.innerWidth < 768,
        media: query,
        onchange: null,
        addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
          if (type === "change") mediaListeners.add(listener)
        },
        removeEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
          if (type === "change") mediaListeners.delete(listener)
        },
        addListener: (listener: LegacyMediaQueryListener | null) => {
          if (!listener) return

          const wrappedListener: EventListener = (event) => {
            listener.call(mediaQueryList, event as MediaQueryListEvent)
          }

          legacyListeners.set(listener, wrappedListener)
          mediaListeners.add(wrappedListener)
        },
        removeListener: (listener: LegacyMediaQueryListener | null) => {
          if (!listener) return

          const wrappedListener = legacyListeners.get(listener)

          if (!wrappedListener) return

          mediaListeners.delete(wrappedListener)
          legacyListeners.delete(listener)
        },
        dispatchEvent: (event: Event) => {
          for (const listener of mediaListeners) {
            if (typeof listener === "function") {
              listener(event)
            } else {
              listener.handleEvent(event)
            }
          }

          return true
        }
      } as MediaQueryList

      return mediaQueryList
    }
  })
})

afterEach(() => {
  cleanup()
  mediaListeners.clear()

  if (originalInnerWidthDescriptor) {
    Object.defineProperty(window, "innerWidth", originalInnerWidthDescriptor)
  }

  if (originalMatchMediaDescriptor) {
    Object.defineProperty(window, "matchMedia", originalMatchMediaDescriptor)
  } else {
    Reflect.deleteProperty(window, "matchMedia")
  }
})

test("switches from mobile to desktop when the viewport reaches the breakpoint", () => {
  setViewportWidth(767)

  const { result } = renderHook(() => useIsMobile())

  expect(result.current).toBe(true)

  setViewportWidth(768)

  act(() => {
    dispatchMediaChange()
  })

  expect(result.current).toBe(false)
})

test("switches from desktop to mobile when the viewport drops below the breakpoint", () => {
  setViewportWidth(768)

  const { result } = renderHook(() => useIsMobile())

  expect(result.current).toBe(false)

  setViewportWidth(767)

  act(() => {
    dispatchMediaChange()
  })

  expect(result.current).toBe(true)
})
