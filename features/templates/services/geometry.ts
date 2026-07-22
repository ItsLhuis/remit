import { type Rect, type Size } from "./canvasLayout"

// Rectangle math shared by hit-testing, gesture updates, and selection geometry: axis-aligned
// primitives plus their rotated counterparts, each with a rotation-0 fast path that reproduces its
// axis-aligned sibling exactly (a rotated block is the common case's superset, not a fork of it).

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

// Rotates a point about a center by degrees, matching the CSS/page rotation convention
// selectionGeometry.ts's handlePositions already uses (clockwise, in the page's y-down space).
export function rotatePoint(point: Point, center: Point, degrees: number): Point {
  if (degrees === 0) return point

  const radians = (degrees * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const dx = point.x - center.x
  const dy = point.y - center.y

  return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos }
}

// A rotated rect's containment test: the point is rotated into the rect's own unrotated frame
// (inverse rotation about the rect's center), then tested with the plain axis-aligned check.
export function pointInRotatedRect(point: Point, rect: Rect, rotation: number): boolean {
  if (rotation === 0) return pointInRect(point, rect)

  const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }

  return pointInRect(rotatePoint(point, center, -rotation), rect)
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

// Separating-axis test for two independently rotated rects: each rect contributes its own two
// perpendicular edge-normal axes (four total), and the rects intersect only when their corner
// projections overlap on every axis. Falls back to the exact axis-aligned test when neither rect is
// rotated, so an unrotated marquee against an unrotated block keeps rectsIntersect's edge-touch
// semantics bit-for-bit.
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

// The axis-aligned bounding box of a rotated rect: the tight box around its four rotated corners.
// Used wherever a rotated block still needs to be treated as a plain axis-aligned rect - page-bounds
// validation today. Rotation 0 returns the rect itself, unchanged. Outputs snap away ~1e-15
// trigonometric noise (axis-aligned rotations of integer rects must produce exact integers, or a
// snugly clamped block would fail the save-time >= 0 bounds check by a femtopixel).
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

// Position-only clamp into the content bounds: whole pixels, no grid quantization (the gesture
// layer decides snapping; this must not undo an intentional Alt off-grid placement). Size is
// never altered, so a rectangle wider than the bounds pins to the origin.
export function clampRectPositionToBounds(rect: Rect, bounds: Size): Rect {
  const x = Math.max(0, Math.min(Math.round(rect.x), bounds.width - rect.width))
  const y = Math.max(0, Math.min(Math.round(rect.y), bounds.height - rect.height))

  return { ...rect, x, y }
}

// The whole-pixel translation that brings a [start, end] span back inside [0, max]: zero when it
// already fits, rounded outward (ceil) so a fractional violation never survives the shift, and
// pinning an oversized span at zero — the exact integer counterpart of clampRectPositionToBounds's
// max(0, min(...)) semantics, usable on the fractional spans a rotated AABB produces.
export function shiftSpanIntoRange(start: number, end: number, max: number): number {
  let shift = 0

  if (end > max) shift = -Math.ceil(end - max)
  if (start + shift < 0) shift = Math.ceil(-start)

  return shift
}

// The rotated counterpart of clampRectPositionToBounds: translates the rect (never resizing it) so
// its rotated AABB stays inside the bounds. Rotation 0 delegates to the axis-aligned clamp exactly.
export function clampRotatedRectPositionToBounds(rect: Rect, rotation: number, bounds: Size): Rect {
  if (rotation === 0) return clampRectPositionToBounds(rect, bounds)

  const aabb = rotatedAabb(rect, rotation)

  return translateRect(rect, {
    x: shiftSpanIntoRange(aabb.x, aabb.x + aabb.width, bounds.width),
    y: shiftSpanIntoRange(aabb.y, aabb.y + aabb.height, bounds.height)
  })
}

// The rotated resize clamp: keeps a rotated reference rect's visual footprint (its rotated AABB)
// inside the bounds. A footprint too large to fit at all scales down uniformly about the rect's
// center first (a rotated rect cannot shrink one axis independently and stay a rectangle in page
// space), then the rect translates back inside. Sizes and shifts round to whole pixels, always
// toward the inside, so the result never fails the save-time rotated-AABB bounds check.
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

// The rotated counterpart of a frame child's origin floor: translates the rect so its rotated AABB
// clears the enclosing frame's origin. Translation only — a frame never bounds its children's far
// edges, so no size change and no upper clamp.
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

// The two perpendicular edge-normal axes of a rect rotated by degrees: (1, 0) and (0, 1) rotated
// the same way the rect's own corners are.
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
