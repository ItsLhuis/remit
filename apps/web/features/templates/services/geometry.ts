import { type Rect, type Size } from "./canvasLayout"

// Rectangle math shared by hit-testing, gestures, and selection geometry. Every rotated primitive
// has a rotation-0 fast path that reproduces its axis-aligned sibling exactly, so a rotated block
// is the common case's superset rather than a fork of it.

export type Point = {
  x: number
  y: number
}

export function pointInRect(point: Point, rect: Rect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  )
}

// Folds any degree value into the canonical [0, 360) range the persisted rotation schema requires
// and the handle-cursor bucketing assumes.
export function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360
}

// Clockwise in the page's y-down space, matching CSS and selectionGeometry.ts's handlePositions.
export function rotatePoint(point: Point, center: Point, degrees: number): Point {
  if (degrees === 0) return point

  const radians = (degrees * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const dx = point.x - center.x
  const dy = point.y - center.y

  return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos }
}

// The point rotates into the rect's own unrotated frame, then takes the plain axis-aligned test.
export function pointInRotatedRect(point: Point, rect: Rect, rotation: number): boolean {
  if (rotation === 0) return pointInRect(point, rect)

  const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }

  return pointInRect(rotatePoint(point, center, -rotation), rect)
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

// Separating-axis test: each rect contributes two edge-normal axes, and they intersect only when
// the corner projections overlap on all four. Falls back to the exact axis-aligned test when
// neither is rotated, keeping rectsIntersect's edge-touch semantics bit-for-bit.
export function rectsIntersectRotated(
  a: Rect,
  rotationA: number,
  b: Rect,
  rotationB: number
): boolean {
  if (rotationA === 0 && rotationB === 0) return rectsIntersect(a, b)

  const cornersA = rectCorners(a, rotationA)
  const cornersB = rectCorners(b, rotationB)

  return [...rectAxes(rotationA), ...rectAxes(rotationB)].every((axis) =>
    rangesOverlap(projectOntoAxis(cornersA, axis), projectOntoAxis(cornersB, axis))
  )
}

// Outputs snap away ~1e-15 trigonometric noise: an axis-aligned rotation of an integer rect must
// produce exact integers, or a snugly clamped block fails the save-time bounds check by a
// femtopixel.
export function rotatedAabb(rect: Rect, rotation: number): Rect {
  if (rotation === 0) return rect

  const corners = rectCorners(rect, rotation)
  const xs = corners.map((corner) => corner.x)
  const ys = corners.map((corner) => corner.y)
  const left = snapTrigNoise(Math.min(...xs))
  const top = snapTrigNoise(Math.min(...ys))

  return {
    x: left,
    y: top,
    width: snapTrigNoise(Math.max(...xs)) - left,
    height: snapTrigNoise(Math.max(...ys)) - top
  }
}

export function translateRect(rect: Rect, delta: Point): Rect {
  return { ...rect, x: rect.x + delta.x, y: rect.y + delta.y }
}

export function unionRects(rects: readonly Rect[]): Rect | null {
  const first = rects[0]

  if (!first) return null

  let left = first.x
  let top = first.y
  let right = first.x + first.width
  let bottom = first.y + first.height

  for (const rect of rects.slice(1)) {
    left = Math.min(left, rect.x)
    top = Math.min(top, rect.y)
    right = Math.max(right, rect.x + rect.width)
    bottom = Math.max(bottom, rect.y + rect.height)
  }

  return { x: left, y: top, width: right - left, height: bottom - top }
}

// No grid quantization - the gesture layer decides snapping, and this must not undo an intentional
// Alt off-grid placement. Size is never altered, so an oversized rectangle pins to the origin.
export function clampRectPositionToBounds(rect: Rect, bounds: Size): Rect {
  const x = Math.max(0, Math.min(Math.round(rect.x), bounds.width - rect.width))
  const y = Math.max(0, Math.min(Math.round(rect.y), bounds.height - rect.height))

  return { ...rect, x, y }
}

// The integer counterpart of clampRectPositionToBounds's max(0, min(...)), usable on the
// fractional spans a rotated AABB produces. Rounded outward so a fractional violation never
// survives the shift.
export function shiftSpanIntoRange(start: number, end: number, max: number): number {
  let shift = 0

  if (end > max) shift = -Math.ceil(end - max)
  if (start + shift < 0) shift = Math.ceil(-start)

  return shift
}

// Translates the rect, never resizing it, so its rotated AABB stays inside the bounds.
export function clampRotatedRectPositionToBounds(rect: Rect, rotation: number, bounds: Size): Rect {
  if (rotation === 0) return clampRectPositionToBounds(rect, bounds)

  const aabb = rotatedAabb(rect, rotation)

  return translateRect(rect, {
    x: shiftSpanIntoRange(aabb.x, aabb.x + aabb.width, bounds.width),
    y: shiftSpanIntoRange(aabb.y, aabb.y + aabb.height, bounds.height)
  })
}

// A footprint too large to fit scales down uniformly about the center first, because a rotated
// rect cannot shrink one axis independently and stay a rectangle in page space. Rounding always
// goes inward, so the result never fails the save-time bounds check.
export function fitRotatedRectWithinBounds(rect: Rect, rotation: number, bounds: Size): Rect {
  const aabb = rotatedAabb(rect, rotation)

  // The 2px margin guarantees an integer translation exists for both edges even with fractional
  // AABB coordinates on each side.
  const scale = Math.min(1, (bounds.width - 2) / aabb.width, (bounds.height - 2) / aabb.height)

  const sized =
    scale >= 1
      ? rect
      : {
          x: Math.round(rect.x + (rect.width - Math.floor(rect.width * scale)) / 2),
          y: Math.round(rect.y + (rect.height - Math.floor(rect.height * scale)) / 2),
          width: Math.floor(rect.width * scale),
          height: Math.floor(rect.height * scale)
        }

  return clampRotatedRectPositionToBounds(sized, rotation, bounds)
}

// Translation only: a frame never bounds its children's far edges, so no size change, no upper
// clamp.
export function floorRotatedRectAtOrigin(rect: Rect, rotation: number, origin: Point): Rect {
  const aabb = rotatedAabb(rect, rotation)

  return translateRect(rect, {
    x: aabb.x < origin.x ? Math.ceil(origin.x - aabb.x) : 0,
    y: aabb.y < origin.y ? Math.ceil(origin.y - aabb.y) : 0
  })
}

function rectCorners(rect: Rect, rotation: number): Point[] {
  const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }

  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height }
  ].map((corner) => rotatePoint(corner, center, rotation))
}

// (1, 0) and (0, 1) rotated the same way the rect's own corners are.
function rectAxes(degrees: number): Point[] {
  const radians = (degrees * Math.PI) / 180

  return [
    { x: Math.cos(radians), y: Math.sin(radians) },
    { x: -Math.sin(radians), y: Math.cos(radians) }
  ]
}

function projectOntoAxis(corners: readonly Point[], axis: Point): { min: number; max: number } {
  const dots = corners.map((corner) => corner.x * axis.x + corner.y * axis.y)

  return { min: Math.min(...dots), max: Math.max(...dots) }
}

function rangesOverlap(a: { min: number; max: number }, b: { min: number; max: number }): boolean {
  return a.min < b.max && b.min < a.max
}

function snapTrigNoise(value: number): number {
  return Math.round(value * 1e6) / 1e6
}
