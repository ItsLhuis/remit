import { type Point } from "../../../services"

// Ctrl/Cmd+wheel zoom-at-pointer: the pointer's offset from the scroll container's own edge is a
// fixed screen-space distance the zoom itself never moves, so re-deriving the scroll offset that
// keeps the same content-space point under that fixed distance is the whole computation -
// independent of centering, padding, or anything else laid out inside the scrollable content.
const WHEEL_ZOOM_SENSITIVITY = 0.002

export type ZoomAtPointerInput = {
  pointer: Point
  containerOrigin: Point
  scroll: Point
  previousZoom: number
  nextZoom: number
}

export function resolveZoomAtPointerScroll(input: ZoomAtPointerInput): Point {
  const { pointer, containerOrigin, scroll, previousZoom, nextZoom } = input
  const offsetX = pointer.x - containerOrigin.x
  const offsetY = pointer.y - containerOrigin.y
  const scale = nextZoom / previousZoom

  return {
    x: (scroll.x + offsetX) * scale - offsetX,
    y: (scroll.y + offsetY) * scale - offsetY
  }
}

// A wheel tick's zoom step: exponential so repeated ticks compound smoothly and a zero delta
// (a plain, non-zooming wheel event) never changes the zoom. Callers clamp the result themselves
// (editor.setZoom already floors/ceils to the editor's zoom range).
export function nextZoomForWheelDelta(currentZoom: number, deltaY: number): number {
  return currentZoom * Math.exp(-deltaY * WHEEL_ZOOM_SENSITIVITY)
}
