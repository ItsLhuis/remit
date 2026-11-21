import { type Rect } from "./canvasLayout"
import { rotatePoint, type Point } from "./geometry"

// The resize pipeline is set-first: single-block resize is scaleBlockSet called with a one-member
// set whose rect equals the reference rect, so it is never a special case.

export type HandleDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw"

export type ResolveHandleResizeInput = {
  baseRect: Rect
  rotation: number
  direction: HandleDirection
  pointerDelta: Point
  aspectLock: boolean
  centerAnchor: boolean
  minWidth: number
  minHeight: number
}

export type ResizeSetMember = {
  id: string
  rect: Rect
  rotation: number
}

type HorizontalAnchor = "left" | "right" | "center"
type VerticalAnchor = "top" | "bottom" | "center"

// The opposite edge or corner is the anchor, and the rect can never invert: the dragged edge stops
// at the anchor minus the minimum size. At nonzero rotation the pointer delta is projected into the
// block's own frame first, so the handle follows its visual direction; at 0 this reduces to the
// exact unrotated path.
export function resolveHandleResize(input: ResolveHandleResizeInput): Rect {
  const {
    baseRect,
    rotation,
    direction,
    pointerDelta,
    aspectLock,
    centerAnchor,
    minWidth,
    minHeight
  } = input

  const localDelta =
    rotation === 0 ? pointerDelta : rotatePoint(pointerDelta, { x: 0, y: 0 }, -rotation)

  const raw = requestedSize({ ...input, pointerDelta: localDelta })
  const locked = aspectLock ? lockAspect(baseRect, direction, raw) : raw

  const size = {
    width: Math.max(locked.width, minWidth),
    height: Math.max(locked.height, minHeight)
  }

  return rotation === 0
    ? anchorResizedRect(baseRect, direction, centerAnchor, size)
    : anchorResizedRectRotated({ baseRect, rotation, direction, centerAnchor, size })
}

// The anchor stays visually fixed for any width/height. The gesture layer re-enters here after
// quantizing or flooring sizes, so every size adjustment keeps the same anchor contract.
export function anchorResizedRect(
  baseRect: Rect,
  direction: HandleDirection,
  centerAnchor: boolean,
  size: { width: number; height: number }
): Rect {
  const horizontalAnchor: HorizontalAnchor = centerAnchor
    ? "center"
    : direction.includes("w")
      ? "right"
      : "left"

  const verticalAnchor: VerticalAnchor = centerAnchor
    ? "center"
    : direction.includes("n")
      ? "bottom"
      : "top"

  return {
    x: anchoredX(horizontalAnchor, baseRect, size.width),
    y: anchoredY(verticalAnchor, baseRect, size.height),
    width: size.width,
    height: size.height
  }
}

// Works in the block's own rotated frame, though the returned rect is always the plain unrotated
// local rectangle. At rotation 0 it reduces algebraically to anchorResizedRect (asserted by an
// equivalence test), which is why resolveHandleResize only reaches for it at nonzero rotation.
export function anchorResizedRectRotated(input: {
  baseRect: Rect
  rotation: number
  direction: HandleDirection
  centerAnchor: boolean
  size: { width: number; height: number }
}): Rect {
  const { baseRect, rotation, direction, centerAnchor, size } = input

  const horizontalFraction = centerAnchor ? 0.5 : direction.includes("w") ? 1 : 0
  const verticalFraction = centerAnchor ? 0.5 : direction.includes("n") ? 1 : 0

  const baseCenter = { x: baseRect.x + baseRect.width / 2, y: baseRect.y + baseRect.height / 2 }
  const anchor = rotatePoint(
    anchorLocalPoint(baseRect, horizontalFraction, verticalFraction),
    baseCenter,
    rotation
  )
  const nextOffset = rotatePoint(
    { x: (horizontalFraction - 0.5) * size.width, y: (verticalFraction - 0.5) * size.height },
    { x: 0, y: 0 },
    rotation
  )

  return {
    x: anchor.x - nextOffset.x - size.width / 2,
    y: anchor.y - nextOffset.y - size.height / 2,
    width: size.width,
    height: size.height
  }
}

// A one-member set whose rect equals baseReference reproduces nextReference exactly, which is what
// makes single-block resize the same primitive as group and multi-selection resize. The map is
// independent of parentage, so nested descendants scale for free once included as members.
export function scaleBlockSet(
  members: readonly ResizeSetMember[],
  baseReference: Rect,
  nextReference: Rect
): Map<string, { rect: Rect; rotation: number }> {
  const scaleX = nextReference.width / baseReference.width
  const scaleY = nextReference.height / baseReference.height

  const result = new Map<string, { rect: Rect; rotation: number }>()

  for (const member of members) {
    const relativeX = member.rect.x - baseReference.x
    const relativeY = member.rect.y - baseReference.y

    result.set(member.id, {
      rect: {
        x: nextReference.x + relativeX * scaleX,
        y: nextReference.y + relativeY * scaleY,
        // Divide before multiplying rather than applying the precomputed scale: the ratio is then
        // exactly 1 for a member equal to baseReference, with no floating-point round-trip.
        width: (member.rect.width / baseReference.width) * nextReference.width,
        height: (member.rect.height / baseReference.height) * nextReference.height
      },
      rotation: member.rotation
    })
  }

  return result
}

// The whole set stops together, instead of one member flattening past the minimum and distorting
// the arrangement. Only ever raises a factor toward 1, so growing is never blocked.
export function clampSetScaleFactors(
  members: readonly ResizeSetMember[],
  baseReference: Rect,
  factors: { scaleX: number; scaleY: number },
  minSize: { width: number; height: number }
): { scaleX: number; scaleY: number } {
  let { scaleX, scaleY } = factors

  for (const member of members) {
    const minScaleXForMember = minSize.width / member.rect.width
    const minScaleYForMember = minSize.height / member.rect.height

    if (scaleX < minScaleXForMember) scaleX = minScaleXForMember
    if (scaleY < minScaleYForMember) scaleY = minScaleYForMember
  }

  return { scaleX, scaleY }
}

// A non-uniform scale across a rotated rectangle is a shear, which the render/PDF pipeline does not
// support, so a rotated member anywhere in the set forces the whole set to scale uniformly.
export function isUniformOnly(members: readonly ResizeSetMember[]): boolean {
  return members.some((member) => member.rotation !== 0)
}

// Doubled under the center anchor, since both symmetric edges move.
function requestedSize(input: ResolveHandleResizeInput): { width: number; height: number } {
  const { baseRect, direction, pointerDelta, centerAnchor } = input

  const factor = centerAnchor ? 2 : 1

  const width =
    direction.includes("e") || direction.includes("w")
      ? baseRect.width + (direction.includes("e") ? pointerDelta.x : -pointerDelta.x) * factor
      : baseRect.width

  const height =
    direction.includes("n") || direction.includes("s")
      ? baseRect.height + (direction.includes("s") ? pointerDelta.y : -pointerDelta.y) * factor
      : baseRect.height

  return { width, height }
}

// A corner handle picks the axis with the larger relative movement and applies its scale to both;
// an edge handle drives one axis directly and derives the cross axis from that same scale.
function lockAspect(
  baseRect: Rect,
  direction: HandleDirection,
  raw: { width: number; height: number }
): { width: number; height: number } {
  const affectsX = direction.includes("e") || direction.includes("w")
  const affectsY = direction.includes("n") || direction.includes("s")

  const scaleX = raw.width / baseRect.width
  const scaleY = raw.height / baseRect.height

  if (affectsX && affectsY) {
    const dominant = Math.abs(scaleX - 1) >= Math.abs(scaleY - 1) ? scaleX : scaleY

    return { width: baseRect.width * dominant, height: baseRect.height * dominant }
  }

  if (affectsX) return { width: raw.width, height: baseRect.height * scaleX }

  return { width: baseRect.width * scaleY, height: raw.height }
}

function anchoredX(anchor: HorizontalAnchor, baseRect: Rect, width: number): number {
  if (anchor === "center") return baseRect.x + baseRect.width / 2 - width / 2
  if (anchor === "right") return baseRect.x + baseRect.width - width

  return baseRect.x
}

function anchoredY(anchor: VerticalAnchor, baseRect: Rect, height: number): number {
  if (anchor === "center") return baseRect.y + baseRect.height / 2 - height / 2
  if (anchor === "bottom") return baseRect.y + baseRect.height - height

  return baseRect.y
}

// A fraction of the base rect (0 = left/top, 1 = right/bottom, 0.5 = center):
// anchorResizedRectRotated's local-frame equivalent of anchoredX/anchoredY's edge selection.
function anchorLocalPoint(rect: Rect, horizontalFraction: number, verticalFraction: number): Point {
  return { x: rect.x + horizontalFraction * rect.width, y: rect.y + verticalFraction * rect.height }
}
