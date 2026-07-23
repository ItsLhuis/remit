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

// Gesture classification and per-gesture update math for the pointer engine.
// Pure logic over the normalized block index: useCanvasEngine owns the DOM and lifecycle; this
// module owns the decisions, delegating primitives to services.

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
  // One shape for single-block, group, and multi-selection resize: targets
  // is the member set, baseReference is the single block's rect | the group's derived rect | the
  // selection union, and uniformOnly forces aspect-locked scaling when any member (including a
  // nested descendant) carries rotation.
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

  // Only the topmost hit's ancestry carries the existing selection into a move; a
  // selected block sitting underneath an unselected one must not steal the press meant for the
  // block actually under the pointer.
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

// Per-frame move math: Shift locks to the dominant axis, the lead rect's
// target position quantizes to the grid (whole pixels under the Alt bypass) so the whole set
// moves in uniform steps, and the top-level members' union rect (excluding any member with a
// parent rect) clamps into the content bounds — matching moveBlocks's commit-time union exactly,
// so a mixed selection never drags further or less far than an arrow-key nudge commits. A member
// with a parent rect floors at that parent's page origin — the same floor moveBlocks applies at
// commit — so the drag preview never paints a child past its frame's origin and then snaps back
// on drop.
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

// Per-frame resize math: resolves the dragged handle into a next reference
// rect (Shift/Alt modifiers, or forced aspect-lock when the set is not uniform-safe because a
// member carries rotation), clamps that reference into the page bounds when the set contains a
// top-level member (shrink-clamped so the anchor never moves; the limits feed the overlay's guide
// lines), floors the resulting scale factors so no member passes the minimum size, and maps every
// member proportionally from the gesture's base reference. A one-member set always reproduces the
// resolved reference rect exactly. Grid quantization applies to a one-member set's sizes only — position
// keeps whatever grid offset it had, which the anchor re-derivation preserves;
// a genuine multi-member set commits whole pixels without quantization so member proportions are
// preserved exactly. A sole frame-child target floors at its parent's page origin every frame,
// the same floor the commit applies, so the preview never paints past it and then snaps back.
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

  // Single-member size quantization re-anchors through the rotated variant at nonzero rotation, so
  // the dragged handle's opposite anchor stays visually fixed in page space after the grid snap.
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
      // A rotated reference bounds by its rotated AABB; the fit translates (and, only when the
      // footprint cannot fit at all, uniformly shrinks) rather than pulling one raw edge.
      clampedReference = fitRotatedRectWithinBounds(sizedReference, baseRotation, bounds)
    }
  } else if (parentRect) {
    if (baseRotation === 0) {
      // Edge-preserving floor, mirroring clampResizeRectToBounds's left/top logic: shrinking the
      // near edge into the parent origin must shrink the size by the same delta so the opposite
      // (anchor) edge never moves.
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
    // The pre-clamp/pre-floor sized reference (quantized to the grid, otherwise untouched): the
    // commit path (useTemplateEditor's resizeBlocks) re-runs its own quantize->clamp against this
    // value instead of the already-clamped `reference`, so the preview and the commit reproduce
    // the exact same clamp result bit-for-bit.
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

// The member set a resize press operates on: the shared base reference plus every unlocked member
// collectResizeMemberIds resolves for the raw target set — a sole frame target scales only its own
// box, every other target set (a leaf, a group, or a multi-selection) flattens each target's full
// descendant subtree into the members that scale together — and, for a sole frame-child target,
// the parent rect its reference floors at. A sole target's base reference is its OWN rect and
// rotation (local-axes resize math needs the unrotated rectangle, never the AABB); a multi-
// selection's is the axis-aligned union at rotation 0. Null when nothing in the selection is
// resizable.
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

// Per-frame rotate math: the pointer's angle about the shared center minus the press origin's
// angle is the delta, applied to every member through the same rotateSetBy the commit runs — the
// preview is the commit by construction. atan2 in the page's y-down space is already clockwise-
// positive, matching the stored rotation convention.
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

// Page-bound limit lines for the overlay while a resize presses against the content box, in the
// existing guide-line visual language (emphasis "reached": the edge sits at the limit). The
// returned `at` is offset by the page margins, matching moveGuides.
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

// The marquee release decision: the default replaces the selection with whatever the marquee
// caught; an additive (Shift) marquee toggles each caught id against the selection that was
// already there instead, leaving untouched ids exactly as they were.
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

// The drop-to-reparent target: the topmost frame under the pointer by paint order, excluding the
// dragged subtree. Locked frames stay valid targets (parity with the legacy droppable behavior).
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

// Double-click/Enter-with-pointer descend: one level from the current single selection toward
// whichever block is actually under the pointer. Null when the point misses every block, when the
// selection is not a single id, or when that id is already the deepest hit (nothing left to
// descend into) — the caller then leaves the selection untouched.
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

// The double-click terminal state: descendAt already returned null, meaning the point sits exactly
// on the current single selection and there is nothing left to descend into. Returns that block's
// id when it is an interactive text leaf eligible for inline editing, else null.
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

// The extra shift that keeps the top-level members' union inside the content bounds: each member
// clamps by its visual footprint — a rotated member contributes its rotated AABB — matching
// moveMath's commit-time union exactly. Members with a parent rect are excluded (children moving
// inside a container are unclamped).
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

// A frame child's per-member floor at its parent's page origin — by the rotated footprint at
// nonzero rotation, the raw near edges at 0 — the same floor moveBlocks applies at commit.
function floorMovedRect(translated: Rect, rotation: number, parentRect: Rect): Rect {
  if (rotation !== 0) return floorRotatedRectAtOrigin(translated, rotation, parentRect)

  return {
    ...translated,
    x: Math.max(translated.x, parentRect.x),
    y: Math.max(translated.y, parentRect.y)
  }
}

// The drilled-in refinement of the click-target rule: when the current selection already sits inside the
// hit's top-level ancestor, a click targets the hit's ancestor at the same depth (the sibling at
// the already-entered level) instead of bouncing back to the top-level ancestor.
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
