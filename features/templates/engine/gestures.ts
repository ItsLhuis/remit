import { MIN_BLOCK_HEIGHT, MIN_BLOCK_WIDTH } from "../schemas"
import {
  ancestorChainOf,
  anchorResizedRect,
  anchorResizedRectRotated,
  clampResizeRectToBounds,
  clampSetScaleFactors,
  collectResizeMemberIds,
  fitRotatedRectWithinBounds,
  floorRotatedRectAtOrigin,
  hitTestBlocks,
  quantizeDegrees,
  quantizeToGrid,
  resolveHandleResize,
  rotatedAabb,
  rotateSetBy,
  scaleBlockSet,
  selectionBounds,
  shiftSpanIntoRange,
  topLevelAncestorOf,
  translateRect,
  unionRects,
  type BlockIndex,
  type ContentBounds,
  type GuideLine,
  type HandleDirection,
  type Point,
  type Rect,
  type ResizeClampLimits,
  type ResizeSetMember,
  type RotatedMember,
  type RotationMember
} from "../services"

// Pure gesture classification and per-frame math over the block index. useCanvasEngine owns the DOM
// and the lifecycle; this module owns the decisions and delegates primitives to services.

// A gesture arms at pointerdown and activates once the pointer travels this many screen pixels;
// below it, release is a click (selection semantics only).
export const GESTURE_ACTIVATION_DISTANCE = 4

export type ActiveGesture =
  | { kind: "move"; ids: string[]; origin: Point; baseRects: Map<string, Rect> }
  | {
      kind: "resize"
      targets: string[]
      direction: HandleDirection
      origin: Point
      baseReference: Rect
      baseRotation: number
      members: ResizeSetMember[]
      uniformOnly: boolean
    }
  // One shape for single-block, group, and multi-selection resize: baseReference is the block's
  // rect, the group's derived rect, or the selection union, and uniformOnly forces aspect-locked
  // scaling when any member (including a nested descendant) carries rotation.
  | { kind: "rotate"; targets: string[]; origin: Point; center: Point }
  | { kind: "pan"; startScroll: Point; startClient: Point }

export type PressClassification =
  | { kind: "toggle"; id: string }
  | { kind: "move"; ids: string[]; selectId: string | null }
  | { kind: "empty" }

// Classification precedence at pointerdown; pan is decided by the engine before this runs.
export function classifyPress(input: {
  index: BlockIndex
  point: Point
  selection: ReadonlySet<string>
  deepSelect: boolean
  toggle: boolean
}): PressClassification {
  const { index, point, selection, deepSelect, toggle } = input

  const hits = hitTestBlocks(index, point)
  const topHit = hits[0]

  if (topHit === undefined) return { kind: "empty" }

  if (deepSelect) return { kind: "move", ids: [topHit], selectId: topHit }

  if (toggle) return { kind: "toggle", id: topLevelAncestorOf(index, topHit) ?? topHit }

  // Only the topmost hit's ancestry carries the selection into a move: a selected block underneath
  // an unselected one must not steal the press meant for the block actually under the pointer.
  const hitsSelection = ancestorChainOf(index, topHit).some((ancestor) => selection.has(ancestor))

  if (hitsSelection && selection.size > 0) {
    return { kind: "move", ids: [...selection], selectId: null }
  }

  const target =
    drilledTarget(index, topHit, selection) ?? topLevelAncestorOf(index, topHit) ?? topHit

  return { kind: "move", ids: [target], selectId: target }
}

export type MoveUpdate = {
  delta: Point
  rects: Map<string, Rect>
}

// Only the lead rect quantizes to the grid, so the whole set moves in uniform steps. The union
// clamp and the per-child floor at the parent's page origin mirror moveBlocks's commit-time math
// exactly, so the preview never drags further than the drop commits and then snaps back.
export function resolveMoveUpdate(input: {
  baseRects: ReadonlyMap<string, Rect>
  origin: Point
  point: Point
  axisLocked: boolean
  snap: boolean
  clamp: boolean
  bounds: ContentBounds
  parentRects?: ReadonlyMap<string, Rect>
  rotations?: ReadonlyMap<string, number>
}): MoveUpdate {
  const { baseRects, origin, point, axisLocked, snap, clamp, bounds, parentRects, rotations } =
    input

  let dx = point.x - origin.x
  let dy = point.y - origin.y

  if (axisLocked) {
    if (Math.abs(dx) >= Math.abs(dy)) {
      dy = 0
    } else {
      dx = 0
    }
  }

  const lead = baseRects.values().next().value

  if (lead) {
    const targetX = snap ? quantizeToGrid(lead.x + dx) : Math.round(lead.x + dx)
    const targetY = snap ? quantizeToGrid(lead.y + dy) : Math.round(lead.y + dy)

    dx = targetX - lead.x
    dy = targetY - lead.y
  }

  if (clamp) {
    const shift = clampMoveDelta({
      baseRects,
      delta: { x: dx, y: dy },
      bounds,
      parentRects,
      rotations
    })

    dx += shift.x
    dy += shift.y
  }

  const rects = new Map<string, Rect>()

  for (const [id, base] of baseRects) {
    const translated = translateRect(base, { x: dx, y: dy })
    const parentRect = parentRects?.get(id)

    rects.set(
      id,
      parentRect ? floorMovedRect(translated, rotations?.get(id) ?? 0, parentRect) : translated
    )
  }

  return { delta: { x: dx, y: dy }, rects }
}

export type ResizeUpdate = {
  reference: Rect
  sizedReference: Rect
  members: Map<string, { rect: Rect; rotation: number }>
  limits: ResizeClampLimits
}

// Clamps shrink rather than translate, so the anchor edge never moves under a resize. Grid
// quantization applies to a one-member set only: a multi-member set commits whole pixels so member
// proportions stay exact. The per-child floor at the parent's page origin mirrors the commit, so
// the preview never paints past it and then snaps back.
export function resolveResizeUpdate(input: {
  members: readonly ResizeSetMember[]
  baseReference: Rect
  baseRotation: number
  direction: HandleDirection
  origin: Point
  point: Point
  shiftKey: boolean
  altKey: boolean
  uniformOnly: boolean
  clamp: boolean
  bounds: ContentBounds
  parentRect?: Rect
}): ResizeUpdate {
  const {
    members,
    baseReference,
    baseRotation,
    direction,
    origin,
    point,
    shiftKey,
    altKey,
    uniformOnly,
    clamp,
    bounds,
    parentRect
  } = input

  const pointerDelta = { x: point.x - origin.x, y: point.y - origin.y }

  const rawReference = resolveHandleResize({
    baseRect: baseReference,
    rotation: baseRotation,
    direction,
    pointerDelta,
    aspectLock: shiftKey || uniformOnly,
    centerAnchor: altKey,
    minWidth: MIN_BLOCK_WIDTH,
    minHeight: MIN_BLOCK_HEIGHT
  })

  // Re-anchored through the rotated variant at nonzero rotation, so the handle's opposite anchor
  // stays visually fixed in page space after the grid snap.
  const quantizedSize = {
    width: Math.max(quantizeToGrid(rawReference.width), MIN_BLOCK_WIDTH),
    height: Math.max(quantizeToGrid(rawReference.height), MIN_BLOCK_HEIGHT)
  }

  const sizedReference =
    members.length <= 1
      ? baseRotation === 0
        ? anchorResizedRect(baseReference, direction, altKey, quantizedSize)
        : anchorResizedRectRotated({
            baseRect: baseReference,
            rotation: baseRotation,
            direction,
            centerAnchor: altKey,
            size: quantizedSize
          })
      : rawReference

  let limits: ResizeClampLimits = {}
  let clampedReference = sizedReference

  if (clamp) {
    if (baseRotation === 0) {
      const clamped = clampResizeRectToBounds(sizedReference, bounds)

      clampedReference = clamped.rect
      limits = clamped.limits
    } else {
      // A rotated reference bounds by its AABB, so the fit translates (shrinking only when the
      // footprint cannot fit at all) rather than pulling one raw edge.
      clampedReference = fitRotatedRectWithinBounds(sizedReference, baseRotation, bounds)
    }
  } else if (parentRect) {
    if (baseRotation === 0) {
      // Mirrors clampResizeRectToBounds's left/top logic: shrinking the near edge into the parent
      // origin shrinks the size by the same delta, so the anchor edge never moves.
      const flooredX = Math.max(clampedReference.x, parentRect.x)
      const flooredY = Math.max(clampedReference.y, parentRect.y)

      clampedReference = {
        x: flooredX,
        y: flooredY,
        width: Math.max(clampedReference.width - (flooredX - clampedReference.x), MIN_BLOCK_WIDTH),
        height: Math.max(
          clampedReference.height - (flooredY - clampedReference.y),
          MIN_BLOCK_HEIGHT
        )
      }
    } else {
      clampedReference = floorRotatedRectAtOrigin(clampedReference, baseRotation, parentRect)
    }
  }

  const factors = {
    scaleX: clampedReference.width / baseReference.width,
    scaleY: clampedReference.height / baseReference.height
  }
  const flooredFactors = clampSetScaleFactors(members, baseReference, factors, {
    width: MIN_BLOCK_WIDTH,
    height: MIN_BLOCK_HEIGHT
  })

  const flooredSize = {
    width: baseReference.width * flooredFactors.scaleX,
    height: baseReference.height * flooredFactors.scaleY
  }

  const nextReference: Rect =
    flooredFactors.scaleX === factors.scaleX && flooredFactors.scaleY === factors.scaleY
      ? clampedReference
      : baseRotation === 0
        ? anchorResizedRect(baseReference, direction, altKey, flooredSize)
        : anchorResizedRectRotated({
            baseRect: baseReference,
            rotation: baseRotation,
            direction,
            centerAnchor: altKey,
            size: flooredSize
          })

  return {
    reference: nextReference,
    // Pre-clamp: useTemplateEditor's resizeBlocks re-runs its own quantize->clamp against this
    // rather than the already-clamped `reference`, so preview and commit agree bit-for-bit.
    sizedReference,
    members: scaleBlockSet(members, baseReference, nextReference),
    limits
  }
}

export type ResizeSet = {
  members: ResizeSetMember[]
  baseRects: Map<string, Rect>
  baseReference: Rect
  baseRotation: number
  parentRect: Rect | null
}

// A sole target's base reference is its OWN rect and rotation, never its AABB: local-axes resize
// math needs the unrotated rectangle. A multi-selection's is the axis-aligned union at rotation 0.
// A sole frame target scales only its own box; every other target set flattens each target's full
// descendant subtree into the members that scale together.
export function collectResizeSet(index: BlockIndex, targets: readonly string[]): ResizeSet | null {
  const soleEntry =
    targets.length === 1 && targets[0] !== undefined ? index.get(targets[0]) : undefined
  const baseReference = soleEntry?.pageRect ?? selectionBounds(index, targets)

  if (!baseReference) return null

  const members: ResizeSetMember[] = []
  const baseRects = new Map<string, Rect>()

  for (const id of collectResizeMemberIds(index, targets)) {
    const entry = index.get(id)

    if (!entry || entry.block.locked) continue

    members.push({ id, rect: entry.pageRect, rotation: entry.rotation })
    baseRects.set(id, entry.pageRect)
  }

  if (members.length === 0) return null

  const parentRect =
    soleEntry?.parentId != null ? (index.get(soleEntry.parentId)?.pageRect ?? null) : null

  return {
    members,
    baseRects,
    baseReference,
    baseRotation: soleEntry?.rotation ?? 0,
    parentRect
  }
}

export type RotateUpdate = {
  // The applied delta in degrees: quantized to a tenth, snapped to 15° steps under Shift.
  degrees: number
  members: Map<string, RotatedMember>
}

// Runs the same rotateSetBy the commit runs, so the preview is the commit by construction. atan2
// in the page's y-down space is already clockwise-positive, matching the stored convention.
export function resolveRotateUpdate(input: {
  members: readonly RotationMember[]
  center: Point
  origin: Point
  point: Point
  snap: boolean
  bounds: ContentBounds
}): RotateUpdate {
  const { members, center, origin, point, snap, bounds } = input

  const startAngle = Math.atan2(origin.y - center.y, origin.x - center.x)
  const angle = Math.atan2(point.y - center.y, point.x - center.x)

  const raw = ((angle - startAngle) * 180) / Math.PI
  const degrees = snap ? Math.round(raw / 15) * 15 : quantizeDegrees(raw)

  return { degrees, members: rotateSetBy(members, center, degrees, bounds) }
}

// The returned `at` is offset by the page margins, matching moveGuides.
export function resizeLimitGuides(
  limits: ResizeClampLimits,
  margins: { top: number; left: number }
): GuideLine[] {
  const edges = [
    {
      key: "page-left",
      orientation: "vertical" as const,
      limit: limits.left,
      offset: margins.left
    },
    {
      key: "page-right",
      orientation: "vertical" as const,
      limit: limits.right,
      offset: margins.left
    },
    { key: "page-top", orientation: "horizontal" as const, limit: limits.top, offset: margins.top },
    {
      key: "page-bottom",
      orientation: "horizontal" as const,
      limit: limits.bottom,
      offset: margins.top
    }
  ]

  return edges
    .filter((edge) => edge.limit !== undefined)
    .map((edge) => ({
      key: edge.key,
      orientation: edge.orientation,
      at: edge.offset + (edge.limit ?? 0),
      emphasis: "reached" as const
    }))
}

// An additive (Shift) marquee toggles each caught id against the existing selection, leaving
// untouched ids exactly as they were, rather than replacing the selection.
export function resolveMarqueeSelection(
  current: ReadonlySet<string>,
  candidates: readonly string[],
  additive: boolean
): string[] {
  if (!additive) return [...candidates]

  const next = new Set(current)

  for (const id of candidates) {
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
  }

  return [...next]
}

// Excludes the dragged subtree. Locked frames stay valid targets, matching the legacy droppable.
export function reparentTargetAt(
  index: BlockIndex,
  point: Point,
  draggedIds: ReadonlySet<string>
): string | null {
  const hits = hitTestBlocks(index, point, { includeLocked: true })

  for (const id of hits) {
    const entry = index.get(id)

    if (entry?.block.type !== "frame") continue

    if (ancestorChainOf(index, id).some((ancestor) => draggedIds.has(ancestor))) continue

    return id
  }

  return null
}

// Descends one level toward the block under the pointer. Null when there is nothing to descend
// into, which the caller reads as "leave the selection untouched".
export function descendAt(
  index: BlockIndex,
  point: Point,
  selection: ReadonlySet<string>
): string | null {
  const hits = hitTestBlocks(index, point)
  const topHit = hits[0]

  if (topHit === undefined) return null

  const selectedId = selection.size === 1 ? [...selection][0] : undefined

  if (selectedId === undefined) return topLevelAncestorOf(index, topHit) ?? topHit

  const chain = ancestorChainOf(index, topHit)
  const position = chain.indexOf(selectedId)

  if (position <= 0) return null

  return chain[position - 1] ?? null
}

// The terminal state after descendAt returns null: the point sits on the current selection with
// nothing left to enter, so a text leaf there becomes the inline-edit target.
export function textEditTargetAt(
  index: BlockIndex,
  point: Point,
  selection: ReadonlySet<string>
): string | null {
  const hits = hitTestBlocks(index, point)
  const topHit = hits[0]

  if (topHit === undefined) return null

  const selectedId = selection.size === 1 ? [...selection][0] : undefined

  if (selectedId === undefined || topHit !== selectedId) return null

  const entry = index.get(selectedId)

  if (entry?.block.type !== "text" || entry.block.locked || entry.block.hidden) return null

  return selectedId
}

// Each member clamps by its visual footprint (a rotated member contributes its rotated AABB),
// matching moveMath's commit-time union. Container children are excluded — they move unclamped.
function clampMoveDelta(input: {
  baseRects: ReadonlyMap<string, Rect>
  delta: Point
  bounds: ContentBounds
  parentRects: ReadonlyMap<string, Rect> | undefined
  rotations: ReadonlyMap<string, number> | undefined
}): Point {
  const { baseRects, delta, bounds, parentRects, rotations } = input

  const topLevelRects = [...baseRects].flatMap(([id, rect]) =>
    parentRects?.has(id) ? [] : [rotatedAabb(rect, rotations?.get(id) ?? 0)]
  )
  const union = unionRects(topLevelRects)

  if (!union) return { x: 0, y: 0 }

  const moved = translateRect(union, delta)

  return {
    x: shiftSpanIntoRange(moved.x, moved.x + moved.width, bounds.width),
    y: shiftSpanIntoRange(moved.y, moved.y + moved.height, bounds.height)
  }
}

// By the rotated footprint at nonzero rotation, the raw near edges at 0.
function floorMovedRect(translated: Rect, rotation: number, parentRect: Rect): Rect {
  if (rotation !== 0) return floorRotatedRectAtOrigin(translated, rotation, parentRect)

  return {
    ...translated,
    x: Math.max(translated.x, parentRect.x),
    y: Math.max(translated.y, parentRect.y)
  }
}

// Once the selection sits inside the hit's top-level ancestor, a click targets the sibling at the
// already-entered depth instead of bouncing back out to the top-level ancestor.
function drilledTarget(
  index: BlockIndex,
  topHit: string,
  selection: ReadonlySet<string>
): string | null {
  const selectedId = selection.size === 1 ? [...selection][0] : undefined

  if (selectedId === undefined) return null

  const selected = index.get(selectedId)

  if (selected?.parentId === null || selected === undefined) return null

  const hitAncestor = topLevelAncestorOf(index, topHit)

  if (hitAncestor === null || topLevelAncestorOf(index, selectedId) !== hitAncestor) return null

  const chain = ancestorChainOf(index, topHit)
  const match = chain.find((id) => index.get(id)?.depth === selected.depth)

  return match ?? null
}
