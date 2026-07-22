import { type Rect } from "./canvasLayout"
import { rotatePoint, type Point } from "./geometry"

// The resize pipeline, set-first: resolveHandleResize resolves a handle
// drag into a next reference rectangle; scaleBlockSet maps every member of a set proportionally
// from a base reference to a next one; clampSetScaleFactors floors the scale so no member drops
// below the minimum size; isUniformOnly reports when a set must scale uniformly because a member
// carries rotation. Single-block resize is scaleBlockSet
// called with a one-member set whose rect equals the reference rect, so it is not a special case.

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

// Pure reference-rectangle resolution for one handle drag. Edge handles resize one axis; corner
// handles resize both; the opposite edge/corner is the anchor. Shift (aspectLock) locks the aspect
// ratio captured in baseRect; Alt (centerAnchor) anchors the center so both symmetric edges move
// together; Shift+Alt combines both. The rect can never invert: the dragged edge stops at the
// anchor minus the minimum size. At nonzero rotation, the pointer delta is projected into the
// block's own rotated frame first (local-axes math) so the handle follows its visual direction, and
// the anchor is re-derived with anchorResizedRectRotated so it stays visually fixed in page space;
// at rotation 0 this reduces to the exact unrotated path (anchorResizedRect), so every existing
// caller sees no change.
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

// Re-derives a resized rect's position from its anchor: the edge/corner opposite the dragged
// handle (or the center under Alt) stays visually fixed for any width/height. resolveHandleResize
// ends here, and the gesture layer reuses it to re-anchor after quantizing sizes to the grid or
// flooring set scale factors, so every size adjustment keeps the same anchor contract.
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

// The rotated counterpart to anchorResizedRect: works in the block's own rotated frame so the
// dragged handle's opposite anchor (or the center, under Alt) stays visually fixed in page space,
// even though the returned rect's x/y/width/height are always the plain unrotated local rectangle.
// At rotation 0 this reduces algebraically to anchorResizedRect's formula exactly (asserted by a
// dedicated equivalence test), which is why resolveHandleResize only reaches for this at nonzero
// rotation.
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

// Maps every member's rect proportionally from the base reference rect to the next one: positions
// scale with the reference origin, sizes scale by the resulting factors. A one-member set whose
// rect equals baseReference reproduces nextReference exactly (relative offset and scale are both
// zero/one at that member), which is what makes single-block resize the same primitive as group and
// multi-selection resize. Nested descendants scale for free as long as their (page-space) rect is
// included as a member: the same proportional map applies to every member independent of parentage.
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
        // Divide before multiplying (member share of base, then applied to next) rather than
        // multiplying by the precomputed scale: this is what makes a one-member set whose rect
        // equals baseReference reproduce nextReference exactly (the ratio is exactly 1, not a
        // value that round-trips through an intermediate division with floating-point error).
        width: (member.rect.width / baseReference.width) * nextReference.width,
        height: (member.rect.height / baseReference.height) * nextReference.height
      },
      rotation: member.rotation
    })
  }

  return result
}

// Floors the requested scale factors so no member's resulting size drops below the minimum: the
// whole set stops together instead of one member flattening past the minimum and distorting the
// arrangement. Only ever raises a factor toward 1 (never lowers one below what was requested), so
// growing is never blocked, only shrinking past the floor.
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

// True when any member of the set - including nested descendants, which callers must flatten into
// members - carries nonzero rotation: a non-uniform scale across a
// rotated rectangle is a shear, which the render/sanitize/PDF pipeline does not support, so the
// gesture forces uniform scaling for the whole set whenever this is true.
export function isUniformOnly(members: readonly ResizeSetMember[]): boolean {
  return members.some((member) => member.rotation !== 0)
}

// The size the pointer asks for before aspect locking: the dragged edge follows the pointer on
// each affected axis (doubled under the center anchor, since both symmetric edges move).
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

// Aspect lock: a corner handle picks the axis with the larger relative movement as dominant and
// applies its scale to both dimensions; an edge handle (which drives only one axis directly)
// derives the cross axis from that same scale.
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

// The unrotated point a resize anchors to, expressed as a fraction of the base rect's width/height
// (0 = left/top, 1 = right/bottom, 0.5 = center) - anchorResizedRectRotated's local-frame
// equivalent of anchoredX/anchoredY's edge selection.
function anchorLocalPoint(rect: Rect, horizontalFraction: number, verticalFraction: number): Point {
  return { x: rect.x + horizontalFraction * rect.width, y: rect.y + verticalFraction * rect.height }
}
