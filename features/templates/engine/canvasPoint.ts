import { type Point } from "../services"

// The single viewport -> canvas conversion. The page element's bounding rect
// already includes the CSS zoom scale, so dividing by zoom yields logical page pixels. Every
// hit-test, guide, and gesture delta goes through here; nothing else divides by zoom.
export function toCanvasPoint(
  event: { clientX: number; clientY: number },
  pageElement: HTMLElement,
  zoom: number
): Point {
  const rect = pageElement.getBoundingClientRect()

  return { x: (event.clientX - rect.left) / zoom, y: (event.clientY - rect.top) / zoom }
}

// The canvas-point-to-content-point conversion every gesture and the context menu share: the page
// margins carve the content box out of the page, so a content-space point (what block layouts and
// hit-testing use) subtracts them from the canvas point.
export function toContentPoint(
  event: { clientX: number; clientY: number },
  pageElement: HTMLElement,
  zoom: number,
  margins: { top: number; left: number }
): Point {
  const point = toCanvasPoint(event, pageElement, zoom)

  return { x: point.x - margins.left, y: point.y - margins.top }
}
