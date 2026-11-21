"use client"

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react"

import { type Point } from "../services"

import { nextZoomForWheelDelta, resolveZoomAtPointerScroll } from "./zoomAtPointer"

type WheelZoomAnchorOptions = {
  scrollRef: RefObject<HTMLDivElement | null>
  zoom: number
  setZoom: (zoom: number) => void
}

// Ctrl/Cmd+wheel zoom-at-pointer. The hook owns both anchor refs because the wheel listener that
// stashes an anchor and the layout effect that consumes it are two halves of one mechanism; the
// host keeps only the scroll element, the DOM node it actually renders.
export function useWheelZoomAnchor({ scrollRef, zoom, setZoom }: WheelZoomAnchorOptions): void {
  // Read through a ref refreshed every render, so the listener attaches exactly once.
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

      // A tick at the zoom clamp is a no-op state set, so React bails the render and the layout
      // effect never consumes this anchor - left stale, the next unrelated zoom change would
      // misapply it. One rAF is enough for a real change to have claimed it, so an anchor still
      // present after that frame belongs to a clamped tick and must be dropped.
      requestAnimationFrame(() => {
        if (pendingZoomAnchorRef.current === anchor) pendingZoomAnchorRef.current = null
      })
    }

    scroll.addEventListener("wheel", handleWheel, { passive: false })

    return () => scroll.removeEventListener("wheel", handleWheel)
  }, [scrollRef])

  // Keyed to the zoom that actually took effect, since setZoom clamps internally, and resolves the
  // scroll offset before the browser can show a frame at the wrong position.
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
