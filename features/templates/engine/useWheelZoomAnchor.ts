"use client"

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react"

import { type Point } from "../services"

import { nextZoomForWheelDelta, resolveZoomAtPointerScroll } from "./zoomAtPointer"

type WheelZoomAnchorOptions = {
  scrollRef: RefObject<HTMLDivElement | null>
  zoom: number
  setZoom: (zoom: number) => void
}

// Ctrl/Cmd+wheel zoom-at-pointer. The hook owns both anchor refs rather than taking them as
// arguments: the wheel listener that stashes an anchor and the layout effect that consumes it are
// two halves of one mechanism, and nothing outside needs to see the state between them. The host
// keeps only the scroll element, because that is the DOM node it renders.
export function useWheelZoomAnchor({ scrollRef, zoom, setZoom }: WheelZoomAnchorOptions): void {
  // The wheel handler reads the latest zoom/setZoom through a ref refreshed every render, so the
  // listener itself attaches exactly once.
  const zoomWheelStateRef = useRef({ zoom, setZoom })

  useEffect(() => {
    zoomWheelStateRef.current = { zoom, setZoom }
  })

  const pendingZoomAnchorRef = useRef<{
    pointer: Point
    containerOrigin: Point
    scroll: Point
    previousZoom: number
  } | null>(null)

  useEffect(() => {
    const scroll = scrollRef.current

    if (!scroll) return

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return

      event.preventDefault()

      const state = zoomWheelStateRef.current
      const containerRect = scroll.getBoundingClientRect()

      const anchor = {
        pointer: { x: event.clientX, y: event.clientY },
        containerOrigin: { x: containerRect.left, y: containerRect.top },
        scroll: { x: scroll.scrollLeft, y: scroll.scrollTop },
        previousZoom: state.zoom
      }

      pendingZoomAnchorRef.current = anchor

      state.setZoom(nextZoomForWheelDelta(state.zoom, event.deltaY))

      // A wheel tick at the zoom clamp is a no-op state set: React bails the render entirely, so
      // the layout effect below never runs to consume/clear this anchor. Left stale, the next
      // unrelated zoom change (toolbar, hotkey, fit) would misapply it. One rAF is enough for a
      // real zoom change's layout effect to have already claimed it; if it's still this same
      // anchor after that frame, this tick clamped to a no-op and the anchor must be dropped.
      requestAnimationFrame(() => {
        if (pendingZoomAnchorRef.current === anchor) pendingZoomAnchorRef.current = null
      })
    }

    scroll.addEventListener("wheel", handleWheel, { passive: false })

    return () => scroll.removeEventListener("wheel", handleWheel)
  }, [scrollRef])

  // editor.setZoom clamps internally, so this is keyed to the zoom that actually took effect: it
  // resolves the matching scroll offset once the new scale has painted, before the browser shows a
  // frame at the wrong scroll position.
  useLayoutEffect(() => {
    const anchor = pendingZoomAnchorRef.current
    const scroll = scrollRef.current

    pendingZoomAnchorRef.current = null

    if (!anchor || !scroll || zoom === anchor.previousZoom) return

    const next = resolveZoomAtPointerScroll({ ...anchor, nextZoom: zoom })

    scroll.scrollLeft = next.x
    scroll.scrollTop = next.y
  }, [scrollRef, zoom])
}
